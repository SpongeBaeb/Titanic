'use client';

import { useEffect, useState } from 'react';
import { soundManager } from '@/lib/sound';
import { refreshAmbience } from '@/lib/ambience';

const KEY = 'titanic_sound';

/**
 * 소리 켜기/끄기. 기본은 꺼져 있다. 한 번 켜면 이 브라우저에서는 기억한다.
 * (브라우저 정책상 켠 뒤 첫 클릭부터 소리가 난다)
 */
export default function SoundToggle() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'on') {
        soundManager.setMute(false);
        setMuted(false);
        refreshAmbience();
      }
    } catch {
      /* 저장이 막혀 있어도 동작한다 */
    }
  }, []);

  const toggle = () => {
    const nextMuted = !muted;
    soundManager.setMute(nextMuted);
    setMuted(nextMuted);
    try {
      localStorage.setItem(KEY, nextMuted ? 'off' : 'on');
    } catch {
      /* 무시 */
    }
    refreshAmbience();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!muted}
      aria-label={muted ? '소리 켜기' : '소리 끄기'}
      title={muted ? '소리 켜기' : '소리 끄기'}
      className="fixed right-4 top-3 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/30 bg-black/45 text-amber-100/90 backdrop-blur-sm transition-colors hover:border-amber-200/70 hover:text-amber-100"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        {muted ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
      </svg>
    </button>
  );
}
