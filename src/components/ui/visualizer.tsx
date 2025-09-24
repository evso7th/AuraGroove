
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Note, InstrumentPart } from '@/types/music';
import BackgroundAnimation from './background-animation';
import type { Dictionary } from '@/lib/dictionaries/en';

interface VisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  activeNotes: (Note & { part: InstrumentPart })[];
  isPlaying: boolean;
  dictionary: Dictionary;
}

type AuraText = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
};

// Returns a random horizontal position.
function getDynamicXPosition(): number {
    return Math.random() * 90 + 5; // Random value between 5% and 95%
}

// Maps a MIDI note (21-108) to a hue value (approx. violet to yellow)
function midiToHue(midi: number): number {
    const minMidi = 28; // E1
    const maxMidi = 88; // E6
    const minHue = 270; // Violet
    const maxHue = 60;  // Yellow

    if (midi <= minMidi) return minHue;
    if (midi >= maxMidi) return maxHue;

    const ratio = (midi - minMidi) / (maxMidi - minMidi);
    
    // Hue wheel is circular, so we need to handle the wrap-around from 360 to 0
    if (minHue > maxHue) {
        return (minHue + ratio * (360 - minHue + maxHue)) % 360;
    } else {
        return minHue + ratio * (maxHue - minHue);
    }
}

export function Visualizer({ isOpen, onClose, activeNotes, isPlaying, dictionary }: VisualizerProps) {
  const [texts, setTexts] = useState<AuraText[]>([]);

  const addText = useCallback(() => {
    if (!document) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--aura-color').trim();
    const newText: AuraText = {
      id: Date.now(),
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      size: Math.random() * 24 + 12, // Font size between 12px and 36px
      color: color || 'hsl(var(--primary))',
    };
    setTexts(current => [...current, newText]);

    // Automatically remove the text after a while
    setTimeout(() => {
      setTexts(current => current.filter(t => t.id !== newText.id));
    }, 5000);
  }, []);

  useEffect(() => {
    if (isOpen && isPlaying) {
      const scheduleNextText = () => {
        const delay = Math.random() * 4000 + 4000; // 4 to 8 seconds
        timeoutId = setTimeout(() => {
          addText();
          scheduleNextText();
        }, delay);
      };

      let timeoutId: NodeJS.Timeout | null = setTimeout(scheduleNextText, Math.random() * 4000);

      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        setTexts([]); // Clear texts when component unmounts or isPlaying changes
      };
    } else {
       setTexts([]);
    }
  }, [isOpen, isPlaying, addText]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={onClose}
          className="absolute inset-0 z-50 cursor-pointer bg-black overflow-hidden"
        >
          {isPlaying && <BackgroundAnimation />}
          
          <div className="absolute inset-0 z-10 pointer-events-none">
            <AnimatePresence>
              {texts.map((text) => (
                <motion.div
                  key={text.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 0.7, 0.7, 0], scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 1 } }}
                  transition={{ duration: 5, ease: "easeInOut" }}
                  style={{
                    position: 'absolute',
                    top: `${text.y}%`,
                    left: `${text.x}%`,
                    fontSize: `${text.size}px`,
                    color: text.color,
                    filter: `blur(${text.size / 10}px)`,
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    textShadow: `0 0 10px ${text.color}, 0 0 20px ${text.color}`,
                  }}
                >
                  {dictionary.auraGroove.title}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <svg width="100%" height="100%" className="absolute inset-0 z-20">
            <defs>
              <filter id="blur-effect" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
              </filter>
            </defs>
            <g filter="url(#blur-effect)">
              <AnimatePresence>
                {isPlaying && activeNotes.map((note) => (
                  <motion.circle
                    key={`${note.part}-${note.midi}-${note.time}`}
                    cx={`${getDynamicXPosition()}%`}
                    cy={`${100 - ((note.midi - 28) / (88 - 28)) * 100}%`}
                    r={note.velocity ? 5 + note.velocity * 25 : 15}
                    fill={`hsl(${midiToHue(note.midi)}, 100%, 70%)`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: [0.5, 1, 0.5], 
                      scale: 1,
                      transition: { duration: note.duration, ease: "easeInOut" } 
                    }}
                    exit={{ 
                      opacity: 0, 
                      scale: 0,
                      transition: { duration: 0.5 }
                    }}
                  />
                ))}
              </AnimatePresence>
            </g>
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
