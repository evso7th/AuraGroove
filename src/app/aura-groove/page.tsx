
'use client';

import { AuraGrooveV2 } from '@/components/aura-groove-v2';
import { Visualizer } from '@/components/ui/visualizer';
import { useAuraGroove } from '@/hooks/use-aura-groove';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/language-context';
import LoadingDots from '@/components/ui/loading-dots';

export default function AuraGrooveUIPage() {
  const { dictionary: dict, loading: langLoading } = useLanguage();
  const auraGrooveProps = useAuraGroove(dict);

  if (langLoading || !dict) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingDots /></div>;
  }
  
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-background overflow-hidden">
      <Visualizer 
        isOpen={auraGrooveProps.isVisualizerOpen}
        onClose={() => auraGrooveProps.setIsVisualizerOpen(false)}
        activeNotes={auraGrooveProps.activeNotes}
        isPlaying={auraGrooveProps.isPlaying}
        dictionary={dict}
      />
      <div className={cn(
        "w-[320px] h-[600px] border rounded-lg flex flex-col overflow-hidden shadow-2xl bg-card text-card-foreground transition-opacity duration-500",
        auraGrooveProps.isVisualizerOpen && "opacity-0 pointer-events-none"
      )}>
        <AuraGrooveV2 {...auraGrooveProps} />
      </div>
    </main>
  );
}
