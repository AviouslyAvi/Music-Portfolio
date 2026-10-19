'use client';

import { PremonitionDemo } from '@/demo/PremonitionDemo';

export function PremonitionDemoFrame() {
  return (
    <div className="demo-frame">
      <PremonitionDemo bootSequence={false} />
    </div>
  );
}
