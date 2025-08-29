
'use client';

import { AuraGroove } from '@/components/aura-groove';
import { Button } from '@/components/ui/button';
import Logo from '@/components/icons';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Loader2 } from 'lucide-react';
import { useAuraGroove } from '@/hooks/use-aura-groove';

export default function Home() {
  const {
    isStarted,
    isInitializing,
    loadingText,
    handleStart,
    ...auraGrooveProps
  } = useAuraGroove();

  if (!isStarted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-lg shadow-2xl text-center">
            <CardHeader>
                <div className="mx-auto mb-4">
                    <Logo className="h-20 w-20" />
                </div>
                <CardTitle className="font-headline text-4xl">Welcome to AuraGroove</CardTitle>
                <CardDescription className="text-lg">Your personal AI-powered ambient music generator.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    Click the button below to start the audio engine and enter the experience.
                </p>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleStart} className="w-full text-lg py-6" disabled={isInitializing}>
                    {isInitializing ? (
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    ) : (
                        <Music className="mr-2 h-6 w-6" />
                    )}
                    {isInitializing ? loadingText : 'Start AuraGroove'}
                </Button>
            </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <AuraGroove {...auraGrooveProps} />
    </main>
  );
}
