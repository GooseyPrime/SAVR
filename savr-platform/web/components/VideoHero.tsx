'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';

// Explicit mp4 delivery so the hero is never a black box in production.
const VIDEOS = [
  'https://res.cloudinary.com/intellme/video/upload/f_mp4,q_auto/download_2_ontzhn.mp4',
  'https://res.cloudinary.com/intellme/video/upload/f_mp4,q_auto/11689587509115154621_sample_1_rddsv2.mp4',
];

const POSTER =
  'https://res.cloudinary.com/intellme/image/upload/w_1280,h_720,c_fill,q_auto,f_auto/v1770328403/SAVR_Logo_NO_BG_3_hixen3.png';

const VIDEO_LOAD_TIMEOUT = 8000;

export default function VideoHero() {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoadTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setShowFallback(true);
    }, VIDEO_LOAD_TIMEOUT);
  }, []);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleVideoEnded = useCallback(() => {
    setCurrentVideoIndex((prev) => (prev + 1) % VIDEOS.length);
  }, []);

  const handleCanPlay = useCallback(() => {
    clearLoadTimeout();
    setShowFallback(false);
  }, [clearLoadTimeout]);

  const handleError = useCallback(() => {
    clearLoadTimeout();
    setShowFallback(true);
  }, [clearLoadTimeout]);

  return (
    <div className="relative mb-8 flex justify-center">
      <div className="relative w-full max-w-[48rem] md:max-w-[72rem] h-auto animate-float px-4 sm:px-6">
        {showFallback ? (
          <Image
            src="https://res.cloudinary.com/intellme/image/upload/w_640,h_640,c_fit,q_auto,f_auto/v1770328403/SAVR_Logo_NO_BG_3_hixen3.png"
            alt="SAVR Logo"
            width={280}
            height={280}
            className="mx-auto w-full max-w-xs h-auto drop-shadow-[0_0_60px_rgba(0,212,255,0.25)]"
            priority
            unoptimized
          />
        ) : (
          <div className="relative" style={{ aspectRatio: '16 / 9' }}>
            <video
              ref={videoRef}
              key={currentVideoIndex}
              src={VIDEOS[currentVideoIndex]}
              poster={POSTER}
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              onCanPlay={handleCanPlay}
              onError={handleError}
              onLoadStart={startLoadTimeout}
              className="w-full h-full rounded-lg drop-shadow-[0_0_60px_rgba(0,212,255,0.25)] object-cover bg-black"
              style={{ aspectRatio: '16 / 9' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
