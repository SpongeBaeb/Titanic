'use client';

import { motion } from 'framer-motion';
import { soundManager } from '@/lib/sound';
import { useState } from 'react';

interface AnswerOptionProps {
  id: string;
  label: string;
  description?: string;
  onClick: () => void;
  isObscured?: boolean;
}

export default function AnswerOption({ id, label, description, onClick, isObscured }: AnswerOptionProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    soundManager.playClick();
    onClick();
  };

  const shakeAnimation: any = {
    x: [0, -1.5, 1.5, -2.5, 2.5, -1, 1, 0],
    y: [0, 1, -1, 1.5, -1.5, 1, -1, 0],
    transition: {
      duration: 0.3,
      repeat: Infinity,
      repeatType: "mirror" as const,
      ease: "linear"
    }
  };

  return (
    <motion.button
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={isObscured && !isHovered ? shakeAnimation : { x: 0, y: 0 }}
      whileHover={{ y: -3, scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
      whileTap={{ scale: 0.96 }}
      onClick={handleClick}
      className={`w-full p-5 border border-dim/30 hover:border-brass transition-colors duration-300 rounded-sm relative group overflow-hidden ${description ? 'text-left' : 'text-center'} ${isObscured ? 'border-red-500/20' : ''}`}
    >
      <div className={`relative z-10 transition-all duration-300 ${isObscured ? 'opacity-0 blur-md group-hover:opacity-100 group-hover:blur-none' : ''}`}>
        <span className={`block text-lg font-sans transition-colors ${isObscured ? 'text-ivory group-hover:text-bright-brass' : 'text-ivory group-hover:text-bright-brass'}`}>
          {label}
        </span>
        {description && (
          <span className="block text-sm font-sans text-muted-ivory mt-2 font-light leading-relaxed">
            {description}
          </span>
        )}
      </div>
      
      {/* Obscured 상태 경고 UI */}
      {isObscured && (
        <div className="absolute inset-0 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity duration-300">
          <div className="h-1/2 w-3/4 bg-slate-800/80 blur-sm rounded-full animate-pulse" />
        </div>
      )}
    </motion.button>
  );
}
