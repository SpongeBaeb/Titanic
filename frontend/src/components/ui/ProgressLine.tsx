'use client';

interface ProgressLineProps {
  currentStep: number;
  totalSteps: number;
}

export default function ProgressLine({ currentStep, totalSteps }: ProgressLineProps) {
  const percentage = (currentStep / totalSteps) * 100;
  
  return (
    <div className="w-full flex items-center space-x-4">
      <div className="text-brass font-display text-base tracking-widest">
        {String(currentStep).padStart(2, '0')} <span className="text-dim text-sm mx-1">/</span> {String(totalSteps).padStart(2, '0')}
      </div>
      <div className="relative flex-1 h-[1px] bg-dim/30">
        <div 
          className="absolute top-0 left-0 h-[1px] bg-brass transition-all duration-700 ease-out"
          style={{ width: `${percentage}%` }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brass shadow-[0_0_8px_rgba(184,154,91,0.8)] transition-all duration-700 ease-out"
          style={{ left: `calc(${percentage}% - 3px)` }}
        />
      </div>
    </div>
  );
}
