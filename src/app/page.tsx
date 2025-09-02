
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudioEngine } from '@/contexts/audio-engine-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const { initialize, isInitializing, isInitialized } = useAudioEngine();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = async () => {
    setError(null);
    const success = await initialize();
    if (success) {
      router.push('/aura-groove');
    } else {
      setError('Failed to initialize the audio engine. Please check the console for details.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-lg shadow-2xl text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <Image src="/assets/icon8.jpeg" alt="AuraGroove Logo" width={80} height={80} className="rounded-full" />
          </div>
          <CardTitle className="font-headline text-4xl">Welcome to AuraGroove</CardTitle>
          <CardDescription className="text-lg">Your personal AI-powered ambient music generator.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground min-h-[20px]">
            {isInitialized
              ? 'Audio engine is ready.'
              : 'Click the button below to initialize the audio engine.'
            }
          </p>
          {error && <p className="text-destructive mt-2">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button onClick={handleStart} disabled={isInitializing || isInitialized} className="w-full text-lg py-6">
            {isInitializing ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <Music className="mr-2 h-6 w-6" />
            )}
            {isInitializing ? 'Initializing...' : isInitialized ? 'Initialized' : 'Start AuraGroove'}
          </Button>
        </CardFooter>
      </Card>
      {/* Add the hidden iframe for the rhythm section */}
      <iframe id="rhythm-frame" src="/rhythm-frame.html" style={{ display: 'none' }} title="Rhythm Engine"></iframe>
    </main>
  );
}
