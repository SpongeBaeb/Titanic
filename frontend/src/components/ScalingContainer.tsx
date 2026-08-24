import React, { useEffect, useState } from 'react';

interface ScalingContainerProps {
  children: React.ReactNode;
  baseWidth?: number;
  baseHeight?: number;
}

export function ScalingContainer({ 
  children, 
  baseWidth = 1280, 
  baseHeight = 720 
}: ScalingContainerProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      // Calculate scale to fit within window while maintaining aspect ratio
      const scaleX = window.innerWidth / baseWidth;
      const scaleY = window.innerHeight / baseHeight;
      // Use the smaller scale so it always fits on screen (letterbox)
      setScale(Math.min(scaleX, scaleY));
    };

    handleResize(); // Initial calculation
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [baseWidth, baseHeight]);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      <div 
        className="relative pointer-events-auto"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center'
        }}
      >
        {children}
      </div>
    </div>
  );
}
