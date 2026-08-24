'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
  rotation: number;
  scale: number;
}

export default function MoneyParticles({ activeOptionId }: { activeOptionId: string | null }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!activeOptionId) {
      setParticles([]);
      return;
    }

    let count = 0;
    if (activeOptionId === 'fare_luxury') count = 40;
    else if (activeOptionId === 'fare_balance') count = 10;
    else if (activeOptionId === 'fare_save') count = 2;

    const newParticles: Particle[] = Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // %
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 4,
      rotation: Math.random() * 360,
      scale: 0.5 + Math.random() * 0.8
    }));

    setParticles(newParticles);
  }, [activeOptionId]);

  if (!activeOptionId || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -50, x: `${p.x}vw`, rotate: 0, opacity: 0, scale: p.scale }}
          animate={{
            y: ['-5vh', '110vh'],
            rotate: [p.rotation, p.rotation + 360 * (Math.random() > 0.5 ? 1 : -1)],
            opacity: [0, 1, 1, 0],
            x: [`${p.x}vw`, `${p.x + (Math.random() * 10 - 5)}vw`]
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-0 w-16 h-16"
          style={{ transformOrigin: 'center' }}
        >
          <img 
            src="/dollar.png" 
            alt="dollar" 
            className="w-full h-full object-contain drop-shadow-md opacity-90" 
          />
        </motion.div>
      ))}
    </div>
  );
}
