'use client';

import { useEffect, useState } from 'react';

/**
 * 전광판을 천장에 매다는 굵은 지지대.
 * /ui/post.webp (구리 기둥 + 볼트 죔쇠 + 황동 받침) 한 장이 있으면 그 이미지를 쓴다.
 * 이미지의 아래쪽 받침이 보드 윗틀에 얹히고, 기둥은 화면 위쪽 밖으로 이어진다.
 * 이미지가 없으면 코드로 그린 황동 기둥을 쓴다.
 */
const SRC = '/ui/post.webp';

export default function BoardPost() {
  const [hasImage, setHasImage] = useState(false);

  useEffect(() => {
    let alive = true;
    const im = new Image();
    im.onload = () => alive && setHasImage(true);
    im.onerror = () => alive && setHasImage(false);
    im.src = SRC;
    return () => {
      alive = false;
    };
  }, []);

  if (hasImage) {
    return (
      <div aria-hidden className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2" style={{ marginBottom: -6 }}>
        <img
          src={SRC}
          alt=""
          draggable={false}
          className="block h-auto w-[54px]"
          style={{ filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.7)) brightness(0.95)' }}
        />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2" style={{ width: 70, height: 90, marginBottom: -16 }}>
      {/* 기둥 */}
      <div
        className="absolute left-1/2 top-3 -translate-x-1/2"
        style={{
          width: 28,
          bottom: 0,
          background: 'linear-gradient(90deg,#241709 0%,#8a6a30 22%,#d2ad62 42%,#9a7835 62%,#4a3414 85%,#1d1307 100%)',
          boxShadow: '2px 0 6px rgba(0,0,0,0.65), -1px 0 3px rgba(0,0,0,0.4)',
        }}
      />
      {/* 기둥 중간의 조임 고리 두 개 */}
      {[34, 58].map((y) => (
        <div
          key={y}
          className="absolute left-1/2 -translate-x-1/2 rounded-[2px]"
          style={{ top: y, width: 36, height: 7, background: 'linear-gradient(180deg,#e0bd72,#6a4d20 60%,#3a2810)', boxShadow: '0 2px 3px rgba(0,0,0,0.7)' }}
        />
      ))}
      {/* 천장 고정판과 볼트 네 개 */}
      <div
        className="absolute left-1/2 top-0 -translate-x-1/2 rounded-[2px]"
        style={{ width: 70, height: 13, background: 'linear-gradient(180deg,#d9b56a,#6b4e22 70%,#33240f)', boxShadow: '0 3px 5px rgba(0,0,0,0.75)' }}
      >
        {[6, 22, 42, 58].map((l) => (
          <span key={l} className="absolute top-[4px] h-[5px] w-[5px] rounded-full bg-[#241709]" style={{ left: l, boxShadow: 'inset 0 1px 1px rgba(255,230,170,0.25)' }} />
        ))}
      </div>
      {/* 보드 윗틀을 물고 있는 죔쇠 블록 */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[2px]"
        style={{ width: 60, height: 20, background: 'linear-gradient(180deg,#e0bd72,#7a5a28 55%,#3a2810)', boxShadow: '0 3px 5px rgba(0,0,0,0.8)' }}
      >
        <span className="absolute left-[9px] top-[7px] h-[6px] w-[6px] rounded-full bg-[#241709]" />
        <span className="absolute right-[9px] top-[7px] h-[6px] w-[6px] rounded-full bg-[#241709]" />
      </div>
    </div>
  );
}
