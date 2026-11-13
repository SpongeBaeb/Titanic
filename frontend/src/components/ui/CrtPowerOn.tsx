'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * 아날로그 화면이 켜지는 전환: 깜깜한 화면 한가운데에 흰 선이 번지고, 위아래 검은 막이 열리며 그 뒤의 화면이 드러난다.
 * 마지막 장면의 불빛이 꺼져 암흑이 된 뒤 결과로 넘어갈 때 쓴다(QuizContainer).
 */
export default function CrtPowerOn() {
  const reduce = useReducedMotion();
  const open = reduce ? 0.4 : 1.5;
  const hold = reduce ? 0.1 : 0.55;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9996] overflow-hidden">
      {/* 위아래 검은 막: 선만 보일 만큼 열려 있다가 활짝 열린다 */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 bg-black"
        initial={{ y: '0%' }}
        animate={{ y: ['0%', '-0.4%', '-100%'] }}
        transition={{ duration: hold + open, times: [0, hold / (hold + open), 1], ease: ['easeOut', [0.7, 0, 0.3, 1]] }}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 h-1/2 bg-black"
        initial={{ y: '0%' }}
        animate={{ y: ['0%', '0.4%', '100%'] }}
        transition={{ duration: hold + open, times: [0, hold / (hold + open), 1], ease: ['easeOut', [0.7, 0, 0.3, 1]] }}
      />
      {/* 가운데로 번지는 흰 선 */}
      <motion.div
        className="absolute left-0 top-1/2 h-[3px] w-full -translate-y-1/2 bg-white"
        style={{ boxShadow: '0 0 22px 6px rgba(190,255,225,0.85)', transformOrigin: '50% 50%' }}
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
        transition={{ duration: hold + open * 0.7, times: [0, hold / (hold + open * 0.7), 1], ease: 'easeOut' }}
      />
      {/* 켜지는 순간 화면이 한 번 번쩍인다 */}
      <motion.div
        className="absolute inset-0"
        style={{ background: 'rgba(210,255,235,0.35)', mixBlendMode: 'screen' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.7, 0] }}
        transition={{ duration: hold + open, times: [0, hold / (hold + open), (hold + open * 0.25) / (hold + open), 1] }}
      />
    </div>
  );
}
