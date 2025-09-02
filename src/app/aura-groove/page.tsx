
'use client';

import { AuraGroove } from '@/components/aura-groove';
import { useAuraGroove } from '@/hooks/use-aura-groove';

export default function AuraGroovePage() {
  const auraGrooveProps = useAuraGroove();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <AuraGroove {...auraGrooveProps} />
      {/* Add the hidden iframe for the rhythm section */}
      <iframe id="rhythm-frame" src="/rhythm-frame.html" style={{ display: 'none' }} title="Rhythm Engine"></iframe>
    </main>
  );
}
