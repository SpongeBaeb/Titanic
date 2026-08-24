'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface StarlitBackgroundProps {
  activeOptionValue?: string;
}

export default function StarlitBackground({ activeOptionValue }: StarlitBackgroundProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [stars, setStars] = useState<{ id: number; x: number; y: number; size: number; delay: number; duration: number }[]>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 40, // -20 to 20 px
        y: (e.clientY / window.innerHeight - 0.5) * 40,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const filterTop = 0;
  const filterHeight = 36;
  const starAreaHeight = 36;

  useEffect(() => {
    // Generate random stars (denser, mostly top half)
    const newStars = Array.from({ length: 350 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * starAreaHeight, 
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }));
    setStars(newStars);
  }, [starAreaHeight]);

  return (
    <div className="fixed inset-0 bg-[#020813]/90 backdrop-blur-lg z-[-2] overflow-hidden pointer-events-none">
      
      {/* Parallax Container */}
      <motion.div 
        className="absolute inset-[-5%] w-[110%] h-[110%]"
        animate={{ x: -mousePos.x, y: -mousePos.y }}
        transition={{ type: 'spring', stiffness: 50, damping: 20 }}
      >
        {/* Ocean Gradient at bottom */}
        <div className="absolute bottom-0 left-0 w-full h-[40%] bg-gradient-to-t from-[#010e24]/90 to-transparent z-10" />

        {/* Star Fade Filter (Dark at top, transparent at bottom) */}
        <div 
          className="absolute left-0 w-full bg-gradient-to-b from-[#020813] to-transparent z-[5]" 
          style={{ top: `${filterTop}%`, height: `${filterHeight}%` }}
        />

        {/* Stars */}
        {stars.map(star => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-slate-200"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
            }}
            animate={{ opacity: [0.1, 0.8, 0.1] }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}



      </motion.div>

      {/* Railing Back (Ocean/Horizon) - 3D Parallax */}
      <motion.img 
        src="/bg/railing_back.png" 
        alt="railing back" 
        className="absolute bottom-0 left-0 w-full h-full object-cover z-[-1]"
        animate={{ x: -mousePos.x * 0.4, y: -mousePos.y * 0.2 }}
        transition={{ type: 'spring', stiffness: 40, damping: 25 }}
      />

      {/* Railing Front (Closest to Camera) - 3D Parallax */}
      <motion.img 
        src="/bg/railing_front.png" 
        alt="railing front" 
        className="absolute bottom-0 left-0 w-full h-full object-cover z-[0]"
        animate={{ x: mousePos.x * 0.6, y: mousePos.y * 0.3 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      />

    </div>
  );
}
