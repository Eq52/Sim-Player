'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { toast } from '@/hooks/use-toast';
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

// ── iOS Detection ──────────────────────────────────────────────
function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  /** Whether the container already controls sizing; player should h-full fill instead of aspect-ratio */
  fillContainer?: boolean;
  onVideoInfo?: (info: { width: number; height: number; duration: number; format: string }) => void;
  onError?: (error: string) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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

// ── Fullscreen helper with webkit fallback ─────────────────────
function getFullscreenElement(): Element | null {
  return document.fullscreenElement || (document as any).webkitFullscreenElement || null;
}

async function requestFullscreen(el: HTMLElement): Promise<void> {
  if (el.requestFullscreen) {
    await el.requestFullscreen();
  } else if ((el as any).webkitRequestFullscreen) {
    (el as any).webkitRequestFullscreen();
  }
}

async function exitFullscreen(): Promise<void> {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    (document as any).webkitExitFullscreen();
  }
}

export default function VideoPlayer({ src, title, poster, fillContainer, onVideoInfo, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const contextMenuTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect PiP support (including webkit prefix for older Safari)
  const [pipSupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    return !!(
      document.pictureInPictureEnabled ||
      (document as any).webkitPictureInPictureEnabled ||
      (HTMLVideoElement.prototype as any).requestPictureInPicture
    );
  });

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const [coverUrl] = useState<string | null>(poster || '/poster.png');
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

  // Track whether resume prompt has been shown for current src
  const resumePromptShownRef = useRef(false);

  // Mobile touch drag state
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // iOS detection
  const [isIOS] = useState(detectIOS);

  // ── Progress management ──────────────────────────────────────
  const saveProgress = useCallback((time: number) => {
    if (!src || !duration) return;
    try {
      localStorage.setItem(`simplayer_progress_${src}`, JSON.stringify({ time, duration }));
    } catch {}
  }, [src, duration]);

  const loadProgress = useCallback((): number => {
    if (!src) return 0;
    try {
      const raw = localStorage.getItem(`simplayer_progress_${src}`);
      if (!raw) return 0;
      return JSON.parse(raw).time || 0;
    } catch { return 0; }
  }, [src]);

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

  const clearProgressForUrl = useCallback(() => {
    if (!src) return;
    try {
      localStorage.removeItem(`simplayer_progress_${src}`);
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

  // Track whether we've retried loading without CORS
  const corsRetryRef = useRef(false);

  // ── Initialize video (DRY: extracted initHls) ────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    corsRetryRef.current = false;

    // iOS Safari: setting crossOrigin breaks HLS native playback
    if (!isIOS) video.crossOrigin = 'anonymous';

    // iOS native HLS handler references (for cleanup)
    let iosErrorHandler: (() => void) | null = null;
    let iosStalledHandler: (() => void) | null = null;
    const isIOSNativeHLS = format === 'HLS' && !Hls.isSupported() && video.canPlayType('application/vnd.apple.mpegurl');

    // DRY: extracted HLS initialization into reusable function
    const initHls = (withCORS: boolean) => {
      if (format === 'HLS' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: withCORS ? (xhr) => { xhr.withCredentials = false; } : undefined,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
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
      } else if (isIOSNativeHLS) {
        video.src = src;
        iosErrorHandler = function iosHlsErrorHandler() {
          video.removeEventListener('error', iosErrorHandler!);
          iosErrorHandler = null;
          setTimeout(() => { if (video.src) video.load(); }, 500);
        };
        video.addEventListener('error', iosErrorHandler);
        iosStalledHandler = function iosHlsStalledHandler() {
          if (!video.paused && video.readyState < 3) {
            const ct = video.currentTime;
            setTimeout(() => { video.currentTime = ct; }, 100);
          }
        };
        video.addEventListener('stalled', iosStalledHandler);
      } else {
        video.src = src;
      }
    };

    initHls(true);

    // If CORS blocks the video load, retry without crossOrigin
    const handleError = () => {
      // iOS native HLS has its own error handler, skip CORS retry
      if (isIOSNativeHLS) return;
      if (!corsRetryRef.current && video.crossOrigin === 'anonymous') {
        corsRetryRef.current = true;
        video.removeAttribute('crossOrigin');
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        initHls(false);
      }
    };

    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('error', handleError);
      if (iosErrorHandler) video.removeEventListener('error', iosErrorHandler);
      if (iosStalledHandler) video.removeEventListener('stalled', iosStalledHandler);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [src, format, onError, isIOS]);

  // ── Video event listeners ────────────────────────────────────
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
    const onPause = () => { setIsPlaying(false); setIsPaused(true); };
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };

    // Auto-save progress every 3 seconds
    const saveTimer = setInterval(() => {
      if (!video.paused && video.currentTime > 0) saveProgress(video.currentTime);
    }, 3000);
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => {
      setIsBuffering(false);
      if (!resumePromptShownRef.current && src) {
        resumePromptShownRef.current = true;
        const saved = loadProgress();
        if (saved > 3 && video.duration > 0 && saved < video.duration - 2) {
          setSavedProgressTime(saved);
          setShowResumePrompt(true);
          if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
          resumePromptTimerRef.current = setTimeout(() => {
            setShowResumePrompt(false);
            clearProgressForUrl();
          }, 5000);
        }
      }
    };

    const onLoadedMetadata = () => {
      onVideoInfo?.({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, format });
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
      if (video.currentTime > 0) saveProgress(video.currentTime);
      // Cleanup resumePromptTimer on unmount
      if (resumePromptTimerRef.current) {
        clearTimeout(resumePromptTimerRef.current);
        resumePromptTimerRef.current = null;
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
  }, [onVideoInfo, format, saveProgress, loadProgress, src, clearProgressForUrl]);

  // Playback rate
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = playbackRate;
  }, [playbackRate]);

  // Toggle play
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  // ── Fullscreen with webkit fallback ──────────────────────────
  const toggleFullscreen = useCallback(async () => {
    const c = containerRef.current;
    const v = videoRef.current;
    if (!c) return;
    try {
      if (!getFullscreenElement()) {
        // iOS Safari only supports fullscreen on <video> via webkitEnterFullscreen
        if (v && (v as any).webkitEnterFullscreen && !c.requestFullscreen) {
          (v as any).webkitEnterFullscreen();
        } else {
          await requestFullscreen(c);
        }
      } else {
        await exitFullscreen();
      }
    } catch (err) { console.error('Fullscreen error:', err); }
  }, []);

  // ── Controls auto-hide ──────────────────────────────────────
  const handleMouseMove = useCallback(() => {
    if (isDraggingRef.current) return; // don't reset timer while dragging
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls((prev) => {
        if (!isPlaying) return true;
        if (contextMenu.visible || showParamsDialog || showShortcutsDialog) return prev;
        return false;
      });
    }, 3000);
  }, [isPlaying, contextMenu.visible, showParamsDialog, showShortcutsDialog]);

  // Keep controls visible while paused
  useEffect(() => {
    if (isPaused) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [isPaused]);

  useEffect(() => {
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          v.currentTime = Math.min(v.duration, v.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          v.volume = Math.min(1, v.volume + 0.1);
          setVolume(v.volume);
          setIsMuted(v.volume === 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          v.volume = Math.max(0, v.volume - 0.1);
          setVolume(v.volume);
          setIsMuted(v.volume === 0);
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, showParamsDialog, showShortcutsDialog]);

  // ── Fullscreen change listener ─────────────────────────────
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!getFullscreenElement();
      setIsFullscreen(isFs);
      // Re-enter fullscreen if dialog was open and browser exited via Esc
      if (!isFs && (showParamsDialog || showShortcutsDialog)) {
        const c = containerRef.current;
        if (c) requestFullscreen(c).catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
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
    if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current);
    contextMenuTimerRef.current = setTimeout(() => dismissContextMenu(), 4000);

    const handleClickOutside = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-context-menu]')) return;
      dismissContextMenu();
    };
    const handleContextMenuOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-context-menu]')) return;
      const container = containerRef.current;
      if (container && !container.contains(target)) { dismissContextMenu(); return; }
      dismissContextMenu();
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('contextmenu', handleContextMenuOutside, true);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('contextmenu', handleContextMenuOutside, true);
      if (contextMenuTimerRef.current) { clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = null; }
    };
  }, [contextMenu.visible, dismissContextMenu]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    const v = videoRef.current;
    if (v) { v.volume = vol; v.muted = vol === 0; }
    setVolume(vol);
    setIsMuted(vol === 0);
  }, []);

  // ── Progress bar: seek helper ────────────────────────────────
  const seekToPosition = useCallback((clientX: number) => {
    const video = videoRef.current;
    const bar = progressRef.current;
    if (!video || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = x * duration;
  }, [duration]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) return; // avoid double-fire at end of drag
      seekToPosition(e.clientX);
    },
    [seekToPosition]
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) return; // hover preview is handled by drag during drag
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
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch (err) { console.error('PiP error:', err); }
  }, []);

  const skipForward = useCallback(() => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.min(v.duration, v.currentTime + 5);
  }, []);

  const skipBackward = useCallback(() => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, v.currentTime - 5);
  }, []);

  // ── Screenshot ──────────────────────────────────────────────
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

      try {
        canvas.toBlob((blob) => {
          if (!blob) { toast({ title: '截图失败', description: '无法生成截图数据' }); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const timestamp = formatTime(video.currentTime).replace(/:/g, '-');
          a.download = `screenshot_${timestamp}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/png');
      } catch {
        toast({ title: '截图失败', description: '跨域视频无法截取画面，视频源未启用 CORS' });
        return;
      }
      setShowScreenshotFlash(true);
      setTimeout(() => setShowScreenshotFlash(false), 300);
    } catch (err) {
      console.error('Screenshot error:', err);
      toast({ title: '截图失败', description: '发生未知错误' });
    }
  }, []); // reads video.currentTime directly from ref

  // ── Mobile touch drag on progress bar ────────────────────────
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) seekToPosition(touch.clientX);
    };
    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [isDragging, seekToPosition]);

  // Double-click to toggle fullscreen
  const lastClickRef = useRef<number>(0);
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now();
      const gap = now - lastClickRef.current;
      lastClickRef.current = now;
      if (gap < 350) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      setTimeout(() => {
        if (Date.now() - lastClickRef.current >= 340) togglePlay();
      }, 360);
    },
    [toggleFullscreen, togglePlay]
  );

  // Right-click context menu handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setShowSpeedMenu(false);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuW = 180;
      const menuH = 120;
      let menuX = e.clientX;
      let menuY = e.clientY;
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
    duration,
    format,
    currentTime,
    playbackRate,
    volume: isMuted ? 0 : volume,
    isMuted,
    buffered,
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden group select-none"
      style={!fillContainer && !isFullscreen ? { aspectRatio: '16/9' } : undefined}
      onMouseMove={handleMouseMove}
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
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        preload="metadata"
        onClick={handleClick}
      />

      {/* Video Cover (shown before first play) */}
      {!hasEverPlayed && coverUrl && (
        <div className={`absolute inset-0 z-15 pointer-events-none ${coverFading ? 'animate-cover-fade-out' : ''}`}>
          <img src={coverUrl} alt="Video cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        </div>
      )}

      {/* Screenshot flash */}
      {showScreenshotFlash && (
        <div className="absolute inset-0 bg-white/30 z-25 pointer-events-none animate-screenshot-flash" />
      )}

      {/* Buffering */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-sim-accent animate-spin" />
        </div>
      )}

      {/* Center Play Button (when paused) */}
      {isPaused && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer" onClick={togglePlay}>
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
            <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-medium truncate max-w-[70%]">
              {title || 'SimPlayer'}
            </h3>
            <span className="text-sim-text-secondary text-xs">{format}</span>
          </div>
        </div>
      </div>

      {/* Progress bar hot zone — controls hidden but hover triggers show; controls visible disables pointer-events to not obscure progress bar */}
      <div
        className="absolute bottom-12 left-0 right-0 z-[29] h-6"
        onMouseMove={() => {
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        }}
      />

      {/* Progress Bar */}
      <div className={`absolute bottom-14 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div
          ref={progressRef}
          className="relative h-1 group/progress cursor-pointer hover:h-2 transition-all"
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => { if (!isDraggingRef.current) setHoverTime(null); }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) {
              e.preventDefault();
              isDraggingRef.current = true;
              setIsDragging(true);
              seekToPosition(t.clientX);
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            }
          }}
        >
          <div className="absolute inset-0 bg-white/15 rounded-full" />
          <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${bufferedProgress}%` }} />
          <div className="absolute inset-y-0 left-0 bg-sim-accent rounded-full" style={{ width: `${progress}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg border-2 border-white/80"
            style={{ left: `${progress}%`, marginLeft: '-6px' }}
          />
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
              <button onClick={handleResumeYes} className="bg-white/15 hover:bg-white/25 text-white text-[11px] px-3 py-1 rounded transition-colors">是</button>
              <button onClick={handleResumeNo} className="bg-white/15 hover:bg-white/25 text-white text-[11px] px-3 py-1 rounded transition-colors">否</button>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/80 to-transparent px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {/* Left controls */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button onClick={togglePlay} className="p-1 sm:p-1.5 rounded hover:bg-white/10 transition-colors text-white" aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" fill="white" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" fill="white" />}
              </button>
              <button onClick={skipBackward} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden sm:block" aria-label="Previous frame">
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={skipForward} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden sm:block" aria-label="Next frame">
                <SkipForward className="w-4 h-4" />
              </button>
              <span className="text-white text-[10px] sm:text-xs font-mono ml-0.5 sm:ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-0.5 sm:gap-1">
              {/* Volume */}
              <div className="flex items-center group/vol">
                <button onClick={toggleMute} className="p-1 sm:p-1.5 rounded hover:bg-white/10 transition-colors text-white" aria-label="Toggle mute">
                  <VolumeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <div className="w-0 group-hover/vol:w-14 sm:group-hover/vol:w-20 overflow-hidden transition-all duration-200">
                  <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={handleVolumeChange} className="sim-range w-14 sm:w-20 h-4" aria-label="Volume" />
                </div>
              </div>

              {/* Playback Speed */}
              <div className="relative">
                <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="p-1 sm:p-1.5 rounded hover:bg-white/10 transition-colors text-white flex items-center gap-0.5 sm:gap-1" aria-label="Playback speed">
                  <span className="text-[10px] sm:text-xs font-medium">{playbackRate}x</span>
                  <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-sim-gray rounded-lg py-1 min-w-[72px] sm:min-w-[80px] shadow-xl border border-white/10">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => { setPlaybackRate(speed); setShowSpeedMenu(false); }}
                        className={`w-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-left hover:bg-white/10 transition-colors ${playbackRate === speed ? 'text-sim-accent font-medium' : 'text-white'}`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Screenshot */}
              <button onClick={handleScreenshot} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden md:block" aria-label="Screenshot" title="截取当前画面">
                <Camera className="w-5 h-5" />
              </button>

              {/* PiP */}
              {pipSupported && (
                <button onClick={handlePiP} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white hidden md:block" aria-label="Picture in Picture">
                  <PictureInPicture2 className="w-5 h-5" />
                </button>
              )}

              {/* Fullscreen */}
              <button onClick={toggleFullscreen} className="p-1.5 rounded hover:bg-white/10 transition-colors text-white" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right-Click Context Menu ── */}
      {contextMenu.visible && (
        <div
          data-context-menu
          className="fixed z-[60] animate-context-menu-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.stopPropagation()}
          onMouseEnter={() => { if (contextMenuTimerRef.current) { clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = null; } }}
          onMouseLeave={() => { if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = setTimeout(dismissContextMenu, 2000); }}
        >
          <div className="bg-black/40 backdrop-blur-xl rounded-lg border border-white/8 shadow-2xl py-1 min-w-[180px] overflow-hidden">
            <button onClick={() => { dismissContextMenu(); handleScreenshot(); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Camera className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">截取当前画面</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            <button onClick={() => { dismissContextMenu(); setShowParamsDialog(true); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Info className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">查看视频参数</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            <button onClick={() => { dismissContextMenu(); setShowShortcutsDialog(true); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Keyboard className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">快捷键帮助</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            {/* Cache clear with toast feedback */}
            <button onClick={() => { dismissContextMenu(); clearAllProgress(); toast({ title: '已清除', description: '所有播放缓存已删除' }); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Trash2 className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">删除播放缓存</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            <a href="https://github.com/Eq52/Sim-Player" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <ExternalLink className="w-3.5 h-3.5 text-sim-accent shrink-0" />
              <span className="text-white/90 text-[13px]">作者网站</span>
            </a>
          </div>
        </div>
      )}

      {/* ── Video Parameters Dialog ── */}
      {showParamsDialog && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowParamsDialog(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl p-4 sm:p-5 w-[320px] sm:w-[360px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-sim-accent" />
                <h3 className="text-white font-medium text-sm">视频参数</h3>
              </div>
              <button onClick={() => setShowParamsDialog(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video URL */}
            <div className="mb-3 p-2.5 rounded-lg bg-white/5">
              <span className="text-white/40 text-[10px] uppercase tracking-wider">视频地址</span>
              <p className="text-white/70 text-[11px] font-mono mt-1 break-all">{src}</p>
            </div>

            {/* Params Grid */}
            <div className="space-y-2">
              <ParamCard icon={<MonitorPlay className="w-4 h-4 text-sim-accent" />} label="格式" value={videoParams.format} />
              <ParamCard icon={<Tv className="w-4 h-4 text-sim-accent" />} label="分辨率" value={videoParams.width > 0 && videoParams.height > 0 ? `${videoParams.width} x ${videoParams.height}` : '加载中...'} />
              <ParamCard icon={<Clock className="w-4 h-4 text-sim-accent" />} label="时长" value={formatTime(videoParams.duration)} />
              <ParamCard icon={<Gauge className="w-4 h-4 text-sim-accent" />} label="当前播放" value={formatTime(videoParams.currentTime)} />
              <ParamCard icon={<Gauge className="w-4 h-4 text-sim-accent" />} label="播放速度" value={`${videoParams.playbackRate}x`} />
              <ParamCard icon={<Volume2 className="w-4 h-4 text-sim-accent" />} label={`音量${videoParams.isMuted ? ' (已静音)' : ''}`} value={videoParams.isMuted ? '静音' : `${Math.round(videoParams.volume * 100)}%`} />

              {/* Buffered */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-sim-accent" />
                  <span className="text-white/60 text-xs">缓冲进度</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs font-mono">{formatTime(videoParams.buffered)} / {formatTime(videoParams.duration)}</span>
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sim-accent/60 rounded-full transition-all"
                      style={{
                        width: videoParams.duration > 0
                          ? `${(videoParams.buffered / videoParams.duration) * 100}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button onClick={() => setShowParamsDialog(false)} className="mt-4 w-full bg-sim-accent/90 hover:bg-sim-accent text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors">
              关闭
            </button>
          </div>
        </div>
      )}

      {/* ── Shortcuts Help Dialog ── */}
      {showShortcutsDialog && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcutsDialog(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl p-4 sm:p-5 w-[300px] sm:w-[340px] max-w-[90vw]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-sim-accent" />
                <h3 className="text-white font-medium text-sm">快捷键帮助</h3>
              </div>
              <button onClick={() => setShowShortcutsDialog(false)} className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {[
                { key: 'Space', desc: '播放 / 暂停' },
                { key: 'K', desc: '播放 / 暂停' },
                { key: '\u2190', desc: '后退 5 秒' },
                { key: '\u2192', desc: '前进 5 秒' },
                { key: '\u2191', desc: '音量 +10%' },
                { key: '\u2193', desc: '音量 -10%' },
                { key: 'F', desc: '全屏 / 退出全屏' },
                { key: 'M', desc: '关闭弹窗' },
                { key: '双击', desc: '全屏 / 退出全屏' },
              ].map(({ key, desc }) => (
                <div key={desc} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
                  <span className="text-white/60 text-xs">{desc}</span>
                  <kbd className="text-white/80 text-[11px] bg-white/10 px-2 py-0.5 rounded font-mono">{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcutsDialog(false)} className="mt-4 w-full bg-sim-accent/90 hover:bg-sim-accent text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors">
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tiny reusable param card ───────────────────────────────── */
function ParamCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-white/60 text-xs">{label}</span>
      </div>
      <span className="text-white text-xs font-mono">{value}</span>
    </div>
  );
}
