
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioEngine } from '@/contexts/audio-engine-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';
import Image from 'next/image';
import LoadingDots from '@/components/ui/loading-dots';

export default function Home() {
  const { initialize, isInitializing, isInitialized } = useAudioEngine();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = async () => {
    if (isInitialized) {
      router.push('/aura-groove');
      return;
    }
    setError(null);
    const success = await initialize();
    if (success) {
      router.push('/aura-groove');
    } else {
      setError('Failed to initialize the audio engine. Please check the console for details.');
    }
  };

  const getButtonText = () => {
    if (isInitializing) return 'Initializing...';
    if (isInitialized) return 'Enter';
    return 'Start AuraGroove';
  };
  
  const getInfoText = () => {
    if (isInitializing) return 'Please wait, the audio engine is initializing...';
    if (isInitialized) return 'Audio engine is ready.';
    return 'Click the button below to initialize the audio engine.';
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-lg shadow-2xl text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <Image src="/assets/icon8.jpeg" alt="AuraGroove Logo" width={80} height={80} className="rounded-full" />
          </div>
          <CardTitle className="font-headline text-4xl">Welcome to AuraGroove</CardTitle>
          <CardDescription className="text-lg">Your personal pure digital ambient music generator.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[60px] flex flex-col items-center justify-center">
          <p className="text-muted-foreground min-h-[20px]">
            {getInfoText()}
          </p>
          {isInitializing && <LoadingDots />}
          {error && <p className="text-destructive mt-2">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button onClick={handleStart} disabled={isInitializing} className="w-full text-lg py-6">
            {!isInitializing && <Music className="mr-2 h-6 w-6" />}
            {getButtonText()}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
