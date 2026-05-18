'use client';

import { useEffect, useState } from 'react';
import VideoPlayer from '@/components/video-player';

function useQueryParams() {
  const [params, setParams] = useState<{ url: string; title: string; rf: string }>({ url: '', title: '', rf: '' });

  useEffect(() => {
    const raw = window.location.search;
    if (!raw) return;

    // Extract title first (it's a simple, known parameter)
    const titleMatch = raw.match(/[?&]title=([^&]*)/);
    const title = titleMatch ? decodeURIComponent(titleMatch[1]) : '';

    // Extract rf (referrer policy control)
    const rfMatch = raw.match(/[?&]rf=([^&]*)/);
    const rf = rfMatch ? decodeURIComponent(rfMatch[1]) : '';

    // Extract url — the video URL itself may contain ? and & characters,
    // so URLSearchParams would incorrectly split it. Instead, capture
    // everything from "url=" until the next known parameter (&title=|&rf=) or end.
    const urlMatch = raw.match(/[?&]url=(.*?)(?:&title=|&rf=|$)/);
    const url = urlMatch ? decodeURIComponent(urlMatch[1]) : '';

    setParams({ url, title, rf });
  }, []);

  return params;
}

function PlayerContent() {
  const { url, title, rf } = useQueryParams();

  if (!url) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center relative overflow-hidden">
        {/* Background image - adaptive to screen */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/cyberpunk-bg.png)' }}
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/50" />
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
          <h1 className="text-white/90 text-2xl sm:text-3xl md:text-4xl font-light tracking-widest">
            SimPlayer
          </h1>
          <p className="text-white/40 text-xs sm:text-sm tracking-wider max-w-md leading-relaxed">
            在 URL 中添加视频地址开始播放
          </p>
          <code className="text-white/20 text-[10px] sm:text-xs mt-2 break-all max-w-lg font-mono leading-relaxed">
            ?url=视频地址&title=标题
          </code>
        </div>
      </div>
    );
  }

  return <VideoPlayer src={url} title={title} noReferrer={rf !== 'dnc'} />;
}

export default function HomePage() {
  return (
    <div
      className="w-full h-screen bg-black flex items-center justify-center"
      suppressHydrationWarning
    >
      <PlayerContent />
    </div>
  );
}
