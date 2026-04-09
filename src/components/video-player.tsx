'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  PictureInPicture2,
  Loader2,
  ChevronDown,
  MonitorPlay,
  Tv,
  Clock,
  Gauge,
  Info,
  ExternalLink,
  X,
  Camera,
  Keyboard,
  Trash2,
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  onVideoInfo?: (info: { width: number; height: number; duration: number; format: string }) => void;
  onError?: (error: string) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function detectFormat(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('hls')) return 'HLS';
  if (lower.includes('.mp4')) return 'MP4';
  if (lower.includes('.webm')) return 'WebM';
  if (lower.includes('.ogg') || lower.includes('.ogv')) return 'OGG';
  return 'Unknown';
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface VideoParams {
  width: number;
  height: number;
  duration: number;
  format: string;
  currentTime: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  buffered: number;
}

export default function VideoPlayer({ src, title, poster, onVideoInfo, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const contextMenuTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect PiP support
  const [pipSupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    return !!document.pictureInPictureEnabled;
  });

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(poster || '/poster.png');
  const [coverFading, setCoverFading] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  // Screenshot flash feedback
  const [showScreenshotFlash, setShowScreenshotFlash] = useState(false);

  // Right-click context menu state (uses viewport coordinates)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });

  // Video params dialog
  const [showParamsDialog, setShowParamsDialog] = useState(false);

  // Shortcuts help dialog
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

  // Resume progress prompt state
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgressTime, setSavedProgressTime] = useState(0);
  const resumePromptTimerRef = useRef<NodeJS.Timeout | null>(null);

  const format = useMemo(() => detectFormat(src), [src]);

  // Video resolution from metadata
  const [videoResolution, setVideoResolution] = useState({ width: 0, height: 0 });

  // Progress restore flag
  const progressRestoredRef = useRef(false);
  // Track whether resume prompt has been shown for current src
  const resumePromptShownRef = useRef(false);

  // Save progress to localStorage based on video URL
  const saveProgress = useCallback((time: number) => {
    if (!src || !duration) return;
    try {
      const key = `simplayer_progress_${src}`;
      localStorage.setItem(key, JSON.stringify({ time, duration }));
    } catch {}
  }, [src, duration]);

  // Load progress from localStorage
  const loadProgress = useCallback((): number => {
    if (!src) return 0;
    try {
      const key = `simplayer_progress_${src}`;
      const raw = localStorage.getItem(key);
      if (!raw) return 0;
      const data = JSON.parse(raw);
      return data.time || 0;
    } catch { return 0; }
  }, [src]);

  // Delete all SimPlayer progress cache
  const clearAllProgress = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('simplayer_progress_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  // Delete progress for a specific URL
  const clearProgressForUrl = useCallback(() => {
    if (!src) return;
    try {
      const key = `simplayer_progress_${src}`;
      localStorage.removeItem(key);
    } catch {}
  }, [src]);

  // Resume / dismiss handlers
  const handleResumeYes = useCallback(() => {
    setShowResumePrompt(false);
    if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
    const video = videoRef.current;
    const saved = loadProgress();
    if (video && saved > 0 && video.duration > 0 && saved < video.duration - 2) {
      video.currentTime = saved;
    }
  }, [loadProgress]);

  const handleResumeNo = useCallback(() => {
    setShowResumePrompt(false);
    if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
    clearProgressForUrl();
  }, [clearProgressForUrl]);



  // Initialize video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (format === 'HLS' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Ready to play
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              onError?.('Network error while loading video. Please check the URL.');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              onError?.('Media error. Trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              onError?.('Fatal error loading video. Please try another URL.');
              hls.destroy();
              break;
          }
        }
      });
      hlsRef.current = hls;
    } else if (format === 'HLS' && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, format, onError]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      setIsPaused(false);
      if (!hasEverPlayed) {
        setHasEverPlayed(true);
        setCoverFading(true);
        setTimeout(() => setCoverFading(false), 500);
      }
    };
    const onPause = () => {
      setIsPlaying(false);
      setIsPaused(true);
    };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    // Auto-save progress every 3 seconds
    const saveTimer = setInterval(() => {
      if (!video.paused && video.currentTime > 0) {
        saveProgress(video.currentTime);
      }
    }, 3000);
    const onDurationChange = () => {
      setDuration(video.duration);
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => {
      setIsBuffering(false);
      // Show resume prompt on first canplay if progress exists
      if (!resumePromptShownRef.current && src) {
        resumePromptShownRef.current = true;
        const saved = loadProgress();
        if (saved > 3 && video.duration > 0 && saved < video.duration - 2) {
          setSavedProgressTime(saved);
          setShowResumePrompt(true);
          // Auto-dismiss after 5 seconds → delete cache
          if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
          resumePromptTimerRef.current = setTimeout(() => {
            setShowResumePrompt(false);
            clearProgressForUrl();
          }, 5000);
        }
      }
    };

    const onLoadedMetadata = () => {
      onVideoInfo?.({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        format,
      });
      setDuration(video.duration);
      setVideoResolution({ width: video.videoWidth, height: video.videoHeight });
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      clearInterval(saveTimer);
      // Save final progress on cleanup
      if (video.currentTime > 0) {
        saveProgress(video.currentTime);
      }
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [onVideoInfo, format, saveProgress, loadProgress, src]);

  // Playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Toggle play
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Controls auto-hide
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !contextMenu.visible && !showParamsDialog) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, contextMenu.visible, showParamsDialog]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          setVolume(video.volume);
          setIsMuted(video.volume === 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          setVolume(video.volume);
          setIsMuted(video.volume === 0);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          if (showParamsDialog || showShortcutsDialog) {
            e.preventDefault();
            setShowParamsDialog(false);
            setShowShortcutsDialog(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen, showParamsDialog, showShortcutsDialog]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);

      // If a dialog was open and browser exited fullscreen via Esc, re-enter fullscreen
      if (!isFs && (showParamsDialog || showShortcutsDialog)) {
        const container = containerRef.current;
        if (container) {
          container.requestFullscreen().catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [showParamsDialog, showShortcutsDialog]);

  // Dismiss context menu helpers
  const dismissContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
    if (contextMenuTimerRef.current) {
      clearTimeout(contextMenuTimerRef.current);
      contextMenuTimerRef.current = null;
    }
  }, []);

  // Auto-dismiss context menu after 4s
  useEffect(() => {
    if (!contextMenu.visible) return;

    if (contextMenuTimerRef.current) {
      clearTimeout(contextMenuTimerRef.current);
    }
    contextMenuTimerRef.current = setTimeout(() => {
      dismissContextMenu();
    }, 4000);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the menu itself
      if (target.closest('[data-context-menu]')) return;
      dismissContextMenu();
    };

    const handleContextMenuOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-context-menu]')) return;
      // If right-clicking outside the container, close menu and let browser handle
      const container = containerRef.current;
      if (container && !container.contains(target)) {
        dismissContextMenu();
        return;
      }
      // If right-clicking inside the container, just close our menu (preventDefault is in handler)
      dismissContextMenu();
    };

    // Delay listener attachment to avoid immediate trigger from the opening right-click
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('contextmenu', handleContextMenuOutside, true);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('contextmenu', handleContextMenuOutside, true);
      if (contextMenuTimerRef.current) {
        clearTimeout(contextMenuTimerRef.current);
        contextMenuTimerRef.current = null;
      }
    };
  }, [contextMenu.visible, dismissContextMenu]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.volume = vol;
      video.muted = vol === 0;
    }
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      const bar = progressRef.current;
      if (!video || !bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      video.currentTime = x * duration;
    },
    [duration]
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      setHoverTime(x * duration);
      setHoverPosition(e.clientX - rect.left);
    },
    [duration]
  );

  const handlePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video || typeof video.requestPictureInPicture !== 'function') return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.min(video.duration, video.currentTime + 5);
    }
  }, []);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 5);
    }
  }, []);

  // Screenshot: capture current video frame and download
  const handleScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = formatTime(currentTime).replace(/:/g, '-');
        a.download = `screenshot_${timestamp}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');

      // Flash feedback
      setShowScreenshotFlash(true);
      setTimeout(() => setShowScreenshotFlash(false), 300);
    } catch (err) {
      console.error('Screenshot error:', err);
    }
  }, [currentTime]);

  // Double-click to toggle fullscreen
  const lastClickRef = useRef<number>(0);
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      const gap = now - lastClickRef.current;
      lastClickRef.current = now;

      if (gap < 350) {
        // Double click → toggle fullscreen
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Single click → toggle play (with slight delay to wait for potential double-click)
      setTimeout(() => {
        if (Date.now() - lastClickRef.current >= 340) {
          togglePlay();
        }
      }, 360);
    },
    [toggleFullscreen, togglePlay]
  );

  // Right-click context menu handler — uses viewport coordinates for fullscreen compat
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Close speed menu if open
      setShowSpeedMenu(false);

      // Use viewport coordinates — position:fixed works in both normal and fullscreen
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuW = 180;
      const menuH = 120;

      let menuX = e.clientX;
      let menuY = e.clientY;

      // Clamp to viewport
      if (menuX + menuW > vw) menuX = vw - menuW - 4;
      if (menuY + menuH > vh) menuY = vh - menuH - 4;
      if (menuX < 4) menuX = 4;
      if (menuY < 4) menuY = 4;

      dismissContextMenu();
      setContextMenu({ visible: true, x: menuX, y: menuY });
    },
    [dismissContextMenu]
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const videoParams: VideoParams = {
    width: videoResolution.width,
    height: videoResolution.height,
    duration: duration,
    format: format,
    currentTime: currentTime,
    playbackRate: playbackRate,
    volume: isMuted ? 0 : volume,
    isMuted: isMuted,
    buffered: buffered,
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden group select-none"
      style={isFullscreen ? undefined : { aspectRatio: '16/9' }}
      onMouseMove={resetControlsTimeout}
      onMouseLeave={() => {
        if (isPlaying && !contextMenu.visible && !showParamsDialog && !showShortcutsDialog) setShowControls(false);
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        preload="metadata"
        onClick={handleClick}
      />

      {/* Video Cover (shown before first play) */}
      {!hasEverPlayed && coverUrl && (
        <div className={`absolute inset-0 z-15 pointer-events-none ${coverFading ? 'animate-cover-fade-out' : ''}`}>
          <img
            src={coverUrl}
            alt="Video cover"
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay for play button visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        </div>
      )}

      {/* Screenshot flash overlay */}
      {showScreenshotFlash && (
        <div className="absolute inset-0 bg-white/30 z-25 pointer-events-none animate-screenshot-flash" />
      )}

      {/* Buffering Indicator */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-sim-accent animate-spin" />
        </div>
      )}

      {/* Center Play Button (when paused) */}
      {isPaused && !isBuffering && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
            <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-medium truncate max-w-[70%]">
              {title || 'Video Player'}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sim-text-secondary text-xs">{format}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className={`absolute bottom-14 left-0 right-0 z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          ref={progressRef}
          className="relative h-1 group/progress cursor-pointer hover:h-2 transition-all"
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-white/15 rounded-full" />
          {/* Buffered */}
          <div
            className="absolute inset-y-0 left-0 bg-white/25 rounded-full"
            style={{ width: `${bufferedProgress}%` }}
          />
          {/* Progress */}
          <div
            className="absolute inset-y-0 left-0 bg-sim-accent rounded-full"
            style={{ width: `${progress}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg border-2 border-white/80"
            style={{ left: `${progress}%`, marginLeft: '-6px' }}
          />
          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-8 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
      </div>

      {/* Resume Progress Prompt */}
      {showResumePrompt && (
        <div className="absolute bottom-16 right-3 z-40 animate-fade-in">
          <div className="bg-black/70 backdrop-blur-md rounded-lg border border-white/10 px-3 py-2.5 shadow-xl">
            <p className="text-white/80 text-[11px] mb-2 whitespace-nowrap">
              跳转至上次播放位置 {formatTime(savedProgressTime)}？
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleResumeYes}
                className="bg-white/15 hover:bg-white/25 text-white text-[11px] px-3 py-1 rounded transition-colors"
              >
                是
              </button>
              <button
                onClick={handleResumeNo}
                className="bg-white/15 hover:bg-white/25 text-white text-[11px] px-3 py-1 rounded transition-colors"
              >
                否
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-gradient-to-t from-black/80 to-transparent px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {/* Left controls */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="p-1 sm:p-1.5 rounded hover:bg-white/10 transition-colors text-white"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5" fill="white" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" fill="white" />
                )}
              </button>

              {/* Skip Back/Forward */}
              <button
                onClick={skipBackward}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden sm:block"
                aria-label="Previous frame"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={skipForward}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden sm:block"
                aria-label="Next frame"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Time */}
              <span className="text-white text-[10px] sm:text-xs font-mono ml-0.5 sm:ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* Volume */}
              <div className="flex items-center group/vol">
                <button
                  onClick={toggleMute}
                  className="p-1 sm:p-1.5 rounded hover:bg-white/10 transition-colors text-white"
                  aria-label="Toggle mute"
                >
                  <VolumeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <div className="w-0 group-hover/vol:w-14 sm:group-hover/vol:w-20 overflow-hidden transition-all duration-200">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="sim-range w-14 sm:w-20 h-4"
                    aria-label="Volume"
                  />
                </div>
              </div>

              {/* Playback Speed */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="p-1 sm:p-1.5 rounded hover:bg-white/10 transition-colors text-white flex items-center gap-0.5 sm:gap-1"
                  aria-label="Playback speed"
                >
                  <span className="text-[10px] sm:text-xs font-medium">{playbackRate}x</span>
                  <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-sim-gray rounded-lg py-1 min-w-[72px] sm:min-w-[80px] shadow-xl border border-white/10">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          setPlaybackRate(speed);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-left hover:bg-white/10 transition-colors ${
                          playbackRate === speed
                            ? 'text-sim-accent font-medium'
                            : 'text-white'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Screenshot button */}
              <button
                onClick={handleScreenshot}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden md:block"
                aria-label="Screenshot"
                title="截取当前画面"
              >
                <Camera className="w-5 h-5" />
              </button>

              {/* PiP — only show if browser supports it */}
              {pipSupported && (
              <button
                onClick={handlePiP}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden md:block"
                aria-label="Picture in Picture"
              >
                <PictureInPicture2 className="w-5 h-5" />
              </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded hover:bg-white/10 transition-colors text-white"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right-Click Context Menu ──────────────────────────────────
          Uses position:fixed with viewport coords so it works perfectly
          in both normal and fullscreen mode. Rendered INSIDE the
          container so it stays visible when the container is the
          fullscreen element. Auto-dismisses after 4 seconds. */}
      {contextMenu.visible && (
        <div
          data-context-menu
          className="fixed z-[60] animate-context-menu-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onMouseEnter={() => {
            // Keep menu alive while hovering over it
            if (contextMenuTimerRef.current) {
              clearTimeout(contextMenuTimerRef.current);
              contextMenuTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            // Re-start auto-dismiss timer when cursor leaves
            if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current);
            contextMenuTimerRef.current = setTimeout(dismissContextMenu, 2000);
          }}
        >
          <div className="bg-black/40 backdrop-blur-xl rounded-lg border border-white/8 shadow-2xl py-1 min-w-[180px] overflow-hidden">
            {/* Screenshot */}
            <button
              onClick={() => {
                dismissContextMenu();
                handleScreenshot();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left"
            >
              <Camera className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">截取当前画面</span>
            </button>

            <div className="mx-2 border-t border-white/8" />

            {/* View Video Parameters */}
            <button
              onClick={() => {
                dismissContextMenu();
                setShowParamsDialog(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left"
            >
              <Info className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">查看视频参数</span>
            </button>

            <div className="mx-2 border-t border-white/8" />

            {/* Shortcuts Help */}
            <button
              onClick={() => {
                dismissContextMenu();
                setShowShortcutsDialog(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left"
            >
              <Keyboard className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">快捷键帮助</span>
            </button>

            <div className="mx-2 border-t border-white/8" />

            {/* Clear Progress Cache */}
            <button
              onClick={() => {
                dismissContextMenu();
                clearAllProgress();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">删除播放缓存</span>
            </button>

            <div className="mx-2 border-t border-white/8" />

            {/* Author Website */}
            <a
              href="https://ericq521.web.app/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismissContextMenu}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">作者网站</span>
            </a>
          </div>
        </div>
      )}

      {/* ── Video Parameters Dialog ──────────────────────────────────
          Also rendered inside the container so it is visible in
          fullscreen. Uses fixed positioning which is scoped to the
          fullscreen element when active. */}
      {showParamsDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowParamsDialog(false)}
        >
          <div
            className="bg-[#1a1b1e]/60 backdrop-blur-xl rounded-xl shadow-2xl border border-white/8 w-full max-w-[420px] mx-4 overflow-hidden animate-dialog-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-4 h-4 text-sim-accent" />
                <h2 className="text-white/90 font-medium text-sm">视频参数</h2>
              </div>
              <button
                onClick={() => setShowParamsDialog(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dialog Content */}
            <div className="p-4 space-y-2.5">
              {/* Video URL */}
              <div className="bg-white/[0.04] rounded-lg p-2.5 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Tv className="w-3 h-3 text-sim-accent" />
                  <span className="text-white/40 text-[11px]">视频地址</span>
                </div>
                <p className="text-white/80 text-[11px] break-all leading-relaxed font-mono">{src}</p>
              </div>

              {/* Params Grid */}
              <div className="grid grid-cols-2 gap-2">
                <ParamCard
                  icon={<Tv className="w-3 h-3" />}
                  label="格式"
                  value={videoParams.format}
                />
                <ParamCard
                  icon={<MonitorPlay className="w-3 h-3" />}
                  label="分辨率"
                  value={
                    videoParams.width > 0 && videoParams.height > 0
                      ? `${videoParams.width} × ${videoParams.height}`
                      : '加载中...'
                  }
                />
                <ParamCard
                  icon={<Clock className="w-3 h-3" />}
                  label="时长"
                  value={formatTime(videoParams.duration)}
                />
                <ParamCard
                  icon={<Clock className="w-3 h-3" />}
                  label="当前播放"
                  value={formatTime(videoParams.currentTime)}
                />
                <ParamCard
                  icon={<Gauge className="w-3 h-3" />}
                  label="播放速度"
                  value={`${videoParams.playbackRate}x`}
                />
                <ParamCard
                  icon={<Volume2 className="w-3 h-3" />}
                  label={`音量${videoParams.isMuted ? ' (已静音)' : ''}`}
                  value={videoParams.isMuted ? '静音' : `${Math.round(videoParams.volume * 100)}%`}
                />
              </div>

              {/* Buffered */}
              <div className="bg-white/[0.04] rounded-lg p-2.5 border border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-sim-accent" />
                    <span className="text-white/40 text-[11px]">缓冲进度</span>
                  </div>
                  <span className="text-white/50 text-[11px] font-mono">
                    {formatTime(videoParams.buffered)} / {formatTime(videoParams.duration)}
                  </span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sim-accent rounded-full transition-all duration-300"
                    style={{
                      width: videoParams.duration > 0
                        ? `${(videoParams.buffered / videoParams.duration) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="px-4 py-2.5 border-t border-white/8 flex justify-end">
              <button
                onClick={() => setShowParamsDialog(false)}
                className="bg-sim-accent/90 hover:bg-sim-accent text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Shortcuts Help Dialog ────────────────────────────────── */}
      {showShortcutsDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/25 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowShortcutsDialog(false)}
        >
          <div
            className="bg-[#1a1b1e]/60 backdrop-blur-xl rounded-xl shadow-2xl border border-white/8 w-full max-w-[380px] mx-4 overflow-hidden animate-dialog-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-sim-accent" />
                <h2 className="text-white/90 font-medium text-sm">快捷键帮助</h2>
              </div>
              <button
                onClick={() => setShowShortcutsDialog(false)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Shortcuts List */}
            <div className="p-4 space-y-2">
              {[
                { key: 'Space', desc: '播放 / 暂停' },
                { key: 'K', desc: '播放 / 暂停' },
                { key: '←', desc: '后退 5 秒' },
                { key: '→', desc: '前进 5 秒' },
                { key: '↑', desc: '音量 +10%' },
                { key: '↓', desc: '音量 -10%' },
                { key: 'F', desc: '全屏 / 退出全屏' },
                { key: 'M', desc: '关闭弹窗' },
                { key: '双击', desc: '全屏 / 退出全屏' },
              ].map(({ key, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5"
                >
                  <span className="text-white/70 text-[13px]">{desc}</span>
                  <kbd className="bg-sim-gray text-sim-accent text-[11px] font-mono px-2 py-0.5 rounded border border-white/10 min-w-[32px] text-center shrink-0 ml-4">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>

            {/* Dialog Footer */}
            <div className="px-4 py-2.5 border-t border-white/8 flex justify-end">
              <button
                onClick={() => setShowShortcutsDialog(false)}
                className="bg-sim-accent/90 hover:bg-sim-accent text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tiny reusable param card ───────────────────────────────── */
function ParamCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.04] rounded-lg p-2.5 border border-white/5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-sim-accent">{icon}</span>
        <span className="text-white/40 text-[11px]">{label}</span>
      </div>
      <p className="text-white/90 text-sm font-medium">{value}</p>
    </div>
  );
}
