'use client';

import { motion, useReducedMotion } from 'framer-motion';

const NOISE_URI = `url("data:image/svg+xml;utf8,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")}")`;

const ANALOG_CSS = `
@keyframes deathNoiseShift { 0%{background-position:0 0} 20%{background-position:-37px 21px} 40%{background-position:19px -43px} 60%{background-position:-52px -17px} 80%{background-position:31px 38px} 100%{background-position:0 0} }
@keyframes deathRollDown { 0%{top:-12%} 100%{top:108%} }
@keyframes deathFlickAnim { 0%,100%{opacity:0.04} 7%{opacity:0.11} 9%{opacity:0.03} 41%{opacity:0.07} 43%{opacity:0.02} 78%{opacity:0.1} 80%{opacity:0.04} }
.deathNoise { animation: deathNoiseShift 0.5s steps(1) infinite; }
.deathRoll { animation: deathRollDown 7s linear infinite; }
.deathFlick { animation: deathFlickAnim 3.7s linear infinite; }
`;


/**
 * 아날로그(CRT) 화면 덮개. 기록이 닫히고 기계 쪽 화면이 열릴 때, 주사선·잡음·가장자리 어둠·놋쇠 틀이 서서히 번져 온다.
 * 사망 카드와 강아지 분기 결말이 같이 쓴다. 클릭은 막지 않는다.
 * @param delay 번지기 시작할 때까지 기다리는 시간(초)
 * @param duration 완전히 번지는 데 걸리는 시간(초)
 * @param fixed 화면 전체에 고정(true)할지, 부모 안에 깔(false)지
 */
export default function AnalogOverlay({ delay = 2.6, duration = 5, fixed = false, z = 40 }: { delay?: number; duration?: number; fixed?: boolean; z?: number }) {
  const reduce = useReducedMotion();
  return (
    <>
      <style>{ANALOG_CSS}</style>
      <motion.div
        aria-hidden
        className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0`}
        style={{ zIndex: z }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduce ? 0.2 : delay, duration: reduce ? 0.6 : duration, ease: 'easeInOut' }}
      >
        {/* 주사선 */}
        <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, rgba(0,0,0,0.28) 2px, rgba(0,0,0,0.28) 3px)', mixBlendMode: 'overlay' }} />
        {/* 잡음 */}
        {!reduce && <div className="absolute inset-0 deathNoise" style={{ backgroundImage: NOISE_URI, backgroundSize: '160px 160px', opacity: 0.1, mixBlendMode: 'screen' }} />}
        {/* 위에서 아래로 천천히 지나가는 밝은 띠 */}
        {!reduce && <div className="absolute inset-x-0 h-24 deathRoll" style={{ background: 'linear-gradient(to bottom, rgba(180,255,220,0), rgba(180,255,220,0.07), rgba(180,255,220,0))' }} />}
        {/* 화면이 볼록하게 휜 느낌: 모서리가 더 어둡고, 안쪽은 인광색이 감돈다 */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(120,255,190,0.07) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.78) 100%)' }} />
        {/* 놋쇠 틀: 기록 밖, 기계 쪽 화면이라는 표시 */}
        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 5px rgba(150,112,48,0.55), inset 0 0 0 7px rgba(40,26,8,0.9), inset 0 0 46px 10px rgba(0,0,0,0.85)' }} />
        {/* 미세한 깜빡임 */}
        {!reduce && <div className="absolute inset-0 deathFlick" style={{ background: 'rgba(200,255,230,0.5)', mixBlendMode: 'soft-light' }} />}
      </motion.div>
    </>
  );
}
