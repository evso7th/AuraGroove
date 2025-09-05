
'use client';

import { AuraGrooveV2 } from '@/components/aura-groove-v2';
import { useAuraGroove } from '@/hooks/use-aura-groove';

export default function AuraGrooveUIPage() {
  const auraGrooveProps = useAuraGroove();

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-4 sm:p-6 bg-background">
      <AuraGrooveV2 {...auraGrooveProps} />
    </main>
  );
}
