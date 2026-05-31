'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onComplete: () => void;
}

export default function IntroVideo({ onComplete }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setFadeOut(true);
      // Wait for fade animation to complete before calling onComplete
      setTimeout(onComplete, 800);
    };

    video.addEventListener('ended', handleEnded);
    return () => video.removeEventListener('ended', handleEnded);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.8s ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      >
        <source src="/videos/intro.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
