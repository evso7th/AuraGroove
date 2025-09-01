# Bass Presets Overview

This document provides a detailed description of the bass presets available in the AuraGroove application, located in `src/lib/bass-synth-manager.ts`. Each preset is designed for a specific sonic purpose, from foundational ambient drones to more defined melodic lines.

---

## 1. Portamento (`portamento`)

*   **Character:** The flagship ambient bass. A smooth, flowing, and atmospheric sound that seamlessly glides between notes. Its long release and dedicated reverb create a rich, resonant "cushion" of sound, perfect for the main ambient textures.
*   **Use Case:** Ideal for the "Evolve" and other ambient styles where notes need to melt into one another, creating a continuous, uninterrupted bass foundation.
*   **Architecture:** `Tone.MonoSynth` with a high `portamento` value.
*   **Key Components:**
    *   **Portamento:** `0.1` — Enables the smooth glide between notes.
    *   **Oscillator:** `fmsine` — A complex sine wave that provides a clean fundamental with subtle harmonic richness.
    *   **Envelope:** A long release (`4.0s`) is the key to its signature "tail", allowing notes to overlap and create a seamless drone.
    *   **Filter Envelope:** A very long filter release (`5.0s`) ensures the sound becomes darker as it fades, rather than just quieter.
    *   **Effects:** This preset has its **own dedicated `Tone.Reverb`** with a long decay (`6s`). This is crucial for its atmospheric quality but also makes it resource-intensive.

---

## 2. Portamento Mobile (`portamentoMob`)

*   **Character:** Functionally identical to the standard `portamento` preset, but optimized for performance on mobile devices. It retains the smooth glide and long note tails.
*   **Use Case:** The default bass sound on mobile devices to prevent audio crackling and performance issues. It provides a similar feel to the desktop version but with a much lower CPU footprint.
*   **Architecture:** `Tone.MonoSynth`.
*   **Key Difference:**
    *   **No Effects:** This preset **does not have its own dedicated reverb**. It is a "dry" synth, relying on global effects if any are applied. This is the single most important optimization for mobile performance.

---

## 3. Bass Groove (`BassGroove`)

*   **Character:** A layered, complex, and "warmer" bass sound with more texture and grit. It's designed to be more present and defined than the `portamento` bass.
*   **Use Case:** Suitable for styles that require a more traditional or "musical" bass line that cuts through the mix.
*   **Architecture:** A layered preset combining two separate `Tone.MonoSynth` instances.
*   **Layers:**
    *   **Fundamental:**
        *   **Synth:** A clean `sine` wave oscillator providing a solid low-end foundation.
        *   **Envelope:** Long release (`4.0s`) to maintain sustain.
        *   **Effects:** Processed through its own `Reverb` and a subtle `Distortion` (`0.05`) to add warmth and "fatness".
    *   **Texture:**
        *   **Synth:** A bright `sawtooth` wave oscillator, playing an octave higher to add harmonic content and definition.
        *   **Volume:** Set to a much lower volume (`-12dB`) to act as a subtle texture rather than a lead.
        *   **Effects:** Processed through a `Chorus` to create a sense of width and movement.

---

## 4. Bass Groove Mobile (`BassGrooveMob`)

*   **Character:** The performance-optimized version of `BassGroove`. It retains the layered structure but is sonically "cleaner" and more direct.
*   **Use Case:** The mobile-friendly alternative for a more defined bass sound.
*   **Architecture:** Layered `Tone.MonoSynth`s.
*   **Key Difference:**
    *   **No Effects:** All internal effects (`Reverb`, `Distortion`, `Chorus`) are removed. Both the fundamental and texture synths are connected directly to the output.
    *   **Shorter Release:** The envelope releases are shortened (`1.6s`) to further reduce CPU load.

---

## 5. Bass Guitar (`bassGuitar`)

*   **Character:** An attempt to emulate the sound of an electric bass guitar using FM synthesis. It has a distinct "plucky" attack and a more focused, less ambient character.
*   **Use Case:** For styles that might require a sound reminiscent of a real instrument, adding a more organic or "funky" feel.
*   **Architecture:** `Tone.MonoSynth`.
*   **Key Components:**
    *   **Oscillator:** `fmsine` — Frequency Modulation is used to create the complex, metallic-tinged harmonics of a plucked string.
    *   **Envelope:** A faster attack (`0.05s`) and a shorter release (`0.8s`) compared to the ambient presets, creating a more percussive and defined note.
    *   **Filter Envelope:** A pronounced filter envelope helps shape the "pluck" at the start of the note.
