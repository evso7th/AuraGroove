
'use client';

import { useLanguage } from '@/contexts/language-context';
import type { Dictionary } from '@/lib/dictionaries/en';
import { ScrollArea } from './ui/scroll-area';

interface UserGuideProps {
    dictionary: Dictionary;
}

const UserGuideContent = ({ dictionary }: { dictionary: Dictionary }) => {
    const d = dictionary.userGuide;
    
    return (
        <div className="prose prose-sm prose-invert max-w-none text-muted-foreground">
            <h2 className="text-xl font-bold text-foreground mb-4">{d.whatIsThis.title}</h2>
            <p className="mb-4">
                {d.whatIsThis.content}
            </p>
            
            <h2 className="text-xl font-bold text-foreground mb-4">{d.forWhom.title}</h2>
            <p className="mb-2">
                {d.forWhom.intro}
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li><strong>{d.forWhom.uses.yoga.title}</strong>: {d.forWhom.uses.yoga.description}</li>
                <li><strong>{d.forWhom.uses.bars.title}</strong>: {d.forWhom.uses.bars.description}</li>
                <li><strong>{d.forWhom.uses.spa.title}</strong>: {d.forWhom.uses.spa.description}</li>
                <li><strong>{d.forWhom.uses.fitness.title}</strong>: {d.forWhom.uses.fitness.description}</li>
                <li><strong>{d.forWhom.uses.personal.title}</strong>: {d.forWhom.uses.personal.description}</li>
            </ul>

            <h2 className="text-xl font-bold text-foreground mb-4">{d.features.title}</h2>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li><strong>{d.features.unique.title}</strong>: {d.features.unique.description}</li>
                <li><strong>{d.features.royaltyFree.title}</strong>: {d.features.royaltyFree.description}</li>
                <li><strong>{d.features.endless.title}</strong>: {d.features.endless.description}</li>
            </ul>

            <h2 className="text-xl font-bold text-foreground mb-4">{d.howItWorks.title}</h2>
            <p className="mb-2">
                <strong>{d.howItWorks.importantNote.title}</strong>: {d.howItWorks.importantNote.description}
            </p>
            <p className="mb-2">{d.howItWorks.techIntro}</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li><strong>{d.howItWorks.tech.markov.title}</strong>: {d.howItWorks.tech.markov.description}</li>
                <li><strong>{d.howItWorks.tech.lsystems.title}</strong>: {d.howItWorks.tech.lsystems.description}</li>
                <li><strong>{d.howItWorks.tech.engine.title}</strong>: {d.howItWorks.tech.engine.description}</li>
            </ul>

            <h2 className="text-xl font-bold text-foreground mb-4">{d.howToUse.title}</h2>
             <p className="mb-2">{d.howToUse.intro}</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li><strong>{d.howToUse.controls.composition.title}</strong>: {d.howToUse.controls.composition.description}</li>
                <li><strong>{d.howToUse.controls.instruments.title}</strong>: {d.howToUse.controls.instruments.description}</li>
                <li><strong>{d.howToUse.controls.samples.title}</strong>: {d.howToUse.controls.samples.description}</li>
                <li><strong>{d.howToUse.controls.mixer.title}</strong>: {d.howToUse.controls.mixer.description}</li>
            </ul>
        </div>
    )
};


export function UserGuide({ dictionary }: UserGuideProps) {
  const { locale } = useLanguage();
  
  // This is a placeholder. A more robust solution would fetch the correct guide.
  // For now, we only have one guide.
  const guideDictionary = dictionary;

  return (
    <ScrollArea className="h-[60vh] pr-4">
       <UserGuideContent dictionary={guideDictionary} />
    </ScrollArea>
  );
}
