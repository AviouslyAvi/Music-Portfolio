'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

export function PremonitionViewed() {
  useEffect(() => {
    track('premonition_viewed');
  }, []);
  return null;
}
