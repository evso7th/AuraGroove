
'use client';

import { AuraGrooveV2 } from '@/components/aura-groove-v2';
import { useAuraGroove } from '@/hooks/use-aura-groove';

export default function AuraGrooveUIPage() {
  const auraGrooveProps = useAuraGroove();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background">
       <div className="w-[400px] h-[600px] border rounded-lg flex flex-col overflow-hidden shadow-2xl bg-card text-card-foreground">
        <AuraGrooveV2 {...auraGrooveProps} />
      </div>
    </main>
  );
}
