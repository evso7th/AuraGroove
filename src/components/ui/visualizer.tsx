
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface VisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  colors: string[];
  isPlaying: boolean;
}

export function Visualizer({ isOpen, onClose, colors, isPlaying }: VisualizerProps) {
  const isMobile = useIsMobile();
  const svgRef = useRef<SVGSVGElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const phaseRef = useRef({ x: 0, y: 0, z: 0 });

  const [pathData, setPathData] = useState('');

  const animate = (time: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
    }
    const deltaTime = (time - lastTimeRef.current) * 0.001;
    lastTimeRef.current = time;
    
    if (isPlaying) {
        phaseRef.current.x += deltaTime * 0.2;
        phaseRef.current.y += deltaTime * 0.3;
        phaseRef.current.z += deltaTime * 0.15;
    }


    const svg = svgRef.current;
    if (!svg) return;

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const cx = width / 2;
    const cy = height / 2;
    const radiusX = width * 0.4;
    const radiusY = height * 0.4;

    const points = [];
    const segments = 120;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      
      const p1 = Math.sin(phaseRef.current.x + angle * 3);
      const p2 = Math.cos(phaseRef.current.y + angle * 5);
      const p3 = Math.sin(phaseRef.current.z + angle * 2);

      const offsetX = p1 * radiusX * 0.1;
      const offsetY = p2 * radiusY * 0.1;
      
      const r = Math.min(radiusX, radiusY) * (0.8 + p3 * 0.2);

      const x = cx + Math.cos(angle) * r + offsetX;
      const y = cy + Math.sin(angle) * r + offsetY;
      
      points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    setPathData(points.join(' ') + ' Z');

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isOpen) {
      lastTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isPlaying]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={onClose}
          className={cn(
            "z-50 cursor-pointer bg-background",
            isMobile ? "fixed inset-0" : "absolute inset-0"
          )}
        >
          <svg ref={svgRef} width="100%" height="100%">
            <defs>
              <radialGradient id="visualizerGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={colors[0] || 'hsl(var(--primary))'} />
                <stop offset="50%" stopColor={colors[1] || 'hsl(var(--accent))'} />
                <stop offset="100%" stopColor={colors[2] || 'hsl(var(--background))'} />
              </radialGradient>
               <filter id="gooey">
                <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10" result="goo" />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
            <path d={pathData} fill="url(#visualizerGradient)" filter="url(#gooey)" />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
