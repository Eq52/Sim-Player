'use client';

import { useEffect, useState } from 'react';
import VideoPlayer from '@/components/video-player';

function useQueryParams() {
  const [params, setParams] = useState<{ url: string; title: string }>({ url: '', title: '' });

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      url: searchParams.get('url') || '',
      title: searchParams.get('title') || '',
    });
  }, []);

  return params;
}

function PlayerContent() {
  const { url, title } = useQueryParams();

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

  return <VideoPlayer src={url} title={title} />;
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
