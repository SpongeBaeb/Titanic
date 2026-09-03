'use client';

import { Question, Option } from '@/data/questions';
import AnswerOption from '@/components/ui/AnswerOption';
import ProgressLine from '@/components/ui/ProgressLine';
import MoneyParticles from '@/components/ui/MoneyParticles';
import StarlitBackground from '@/components/ui/StarlitBackground';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface QuestionViewProps {
  question: Question;
  onAnswer: (value: string) => void;
  onBack: () => void;
}

export default function QuestionView({ question, onAnswer, onBack }: QuestionViewProps) {
  const [hoveredOption, setHoveredOption] = useState<Option | null>(null);

  const isQ4 = question.id === 'Q4';
  const isQ5 = question.id === 'Q5';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] as [number, number, number, number] } 
    }
  };

  return (
    <div className="w-full relative max-w-xl mx-auto flex flex-col min-h-screen py-12 px-6">
      
      {/* Money Particles (Q4 Effect) */}
      {isQ4 && <MoneyParticles activeOptionId={hoveredOption?.id || null} />}

      {/* Starlit Background (Q5 Effect) */}
      {isQ5 && <StarlitBackground activeOptionValue={hoveredOption?.value} />}

      {/* Dynamic Background Image */}
      {!isQ5 && (
        <AnimatePresence>
          {hoveredOption?.bgImage && (
            <motion.div
              key={hoveredOption.id}
              initial={{ 
                opacity: 0, 
                x: hoveredOption.bgAlign === 'left' ? -50 : (hoveredOption.bgAlign === 'right' ? 50 : 0),
                scale: 1.05
              }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ 
                opacity: 0, 
                x: hoveredOption.bgAlign === 'left' ? -50 : (hoveredOption.bgAlign === 'right' ? 50 : 0),
                scale: 1.05
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`fixed top-1/2 -translate-y-1/2 w-full h-full pointer-events-none z-[-1] flex items-center justify-center
                ${hoveredOption.bgAlign === 'full' 
                  ? 'left-1/2 -translate-x-1/2 max-w-none max-h-none' 
                  : 'max-w-[90vw] max-h-[70vh] md:max-w-[400px]'}
                ${hoveredOption.bgAlign === 'left' ? 'left-4 md:left-[10%]' : ''}
                ${hoveredOption.bgAlign === 'right' ? 'right-4 md:right-[10%]' : ''}
                ${!hoveredOption.bgAlign ? 'left-1/2 -translate-x-1/2' : ''}
                ${hoveredOption.bgOffset || ''}
              `}
            >
              <img 
                src={hoveredOption.bgImage} 
                className={`w-full h-full ${
                  hoveredOption.bgAlign === 'full' 
                    ? 'object-cover' 
                    : `object-contain ${['Q1', 'Q2'].includes(question.id) ? 'opacity-90' : 'opacity-40'}`
                }`} 
                alt="background"
              />
              {hoveredOption.bgAlign === 'full' && (
                <div className="absolute inset-0 bg-slate-950/60" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Back Button */}
      <button 
        onClick={onBack}
        className="fixed bottom-8 left-8 z-50 flex items-center text-slate-400 hover:text-amber-400 transition-colors group"
      >
        <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span>
        <span className="text-sm font-sans tracking-widest uppercase">Back</span>
      </button>
      <div className="mb-12 mt-4">
        <ProgressLine currentStep={question.step} totalSteps={question.totalSteps} />
      </div>
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col justify-center mb-10"
      >
        <motion.h2 
          variants={itemVariants}
          className={`text-2xl md:text-3xl font-display font-bold mb-6 leading-relaxed ${
            ['Q6', 'Q7'].includes(question.id) ? 'text-emergency-red drop-shadow-[0_0_8px_rgba(182,65,53,0.5)]' : 'text-ivory'
          }`}
        >
          {question.title}
        </motion.h2>
        
        {question.subtitle && (
          <motion.p 
            variants={itemVariants}
            className="text-muted-ivory font-sans text-base leading-loose"
          >
            {question.subtitle}
          </motion.p>
        )}
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={`mb-8 w-full ${question.options.some(o => o.description) ? 'flex flex-col space-y-4' : 'grid grid-cols-2 gap-4'}`}
      >
        {question.options.map((option, index) => (
          <motion.div
            key={option.id}
            variants={itemVariants}
            onMouseEnter={() => setHoveredOption(option)}
            onMouseLeave={() => setHoveredOption(null)}
          >
            <AnswerOption
              id={option.id}
              label={option.label}
              description={option.description}
              onClick={() => onAnswer(option.value)}
              isObscured={question.id === 'Q6'}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
