
import { useState, useEffect } from 'react';
import type { MixProfile } from '@/types/music';

/**
 * A hook to determine the device type ('desktop' or 'mobile') based on touch capabilities.
 * This is more reliable than viewport size for adapting audio experiences.
 * It runs only on the client-side after mounting.
 */
export function useDeviceType(): MixProfile {
  const [deviceType, setDeviceType] = useState<MixProfile>('desktop');

  useEffect(() => {
    // Check for touch capabilities, which is a good proxy for mobile devices.
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    setDeviceType(hasTouch ? 'mobile' : 'desktop');
  }, []);

  return deviceType;
}

    