
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Note, InstrumentPart } from '@/types/music';

interface VisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  activeNotes: (Note & { part: InstrumentPart })[];
  isPlaying: boolean;
}

const PART_X_POSITION: Record<InstrumentPart, number> = {
    bass: 20,
    accompaniment: 50,
    melody: 80,
    drums: 50,
    effects: 50,
    sparkles: 50,
    pads: 50,
};

// Maps a MIDI note (21-108) to a hue value (approx. violet to yellow)
function midiToHue(midi: number): number {
    const minMidi = 21; // A0
    const maxMidi = 108; // C8
    const minHue = 270; // Violet
    const maxHue = 60; // Yellow

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


export function Visualizer({ isOpen, onClose, activeNotes, isPlaying }: VisualizerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={onClose}
          className="absolute inset-0 z-50 cursor-pointer bg-black"
        >
          <svg width="100%" height="100%">
            <defs>
              <filter id="visualizer-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7" result="goo" />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
            <g filter="url(#visualizer-goo)">
              <AnimatePresence>
                {isPlaying && activeNotes.map((note) => (
                  <motion.circle
                    key={`${note.part}-${note.midi}-${note.time}`}
                    cx={`${PART_X_POSITION[note.part]}%`}
                    cy={`${100 - ((note.midi - 20) / 88) * 100}%`}
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
