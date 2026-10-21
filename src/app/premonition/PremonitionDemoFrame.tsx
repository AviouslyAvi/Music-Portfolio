'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';

// The engine and plugin UI load only here, in the browser, when this frame mounts.
const PluginScreen = dynamic(() => import('@/premonition/PluginScreen').then((m) => m.PluginScreen), { ssr: false });

export function PremonitionDemoFrame() {
  const [played, setPlayed] = useState<ReadonlySet<string>>(() => new Set());
  const onSoundPlayed = useCallback((id: string) => setPlayed((prev) => new Set(prev).add(id)), []);
  return (
    <div style={{ width: '100%', maxWidth: 920, margin: '0 auto' }}>
      <PluginScreen playedIds={played} onSoundPlayed={onSoundPlayed} />
    </div>
  );
}
