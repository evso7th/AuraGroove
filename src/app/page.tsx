
'use client';

import { useState } from 'react';
import * as Tone from 'tone';
import { Button } from '@/components/ui/button';
import Logo from '@/components/icons';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Loader2 } from 'lucide-react';

export default function Home() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const handleStart = async () => {
    setIsInitializing(true);
    console.log('[CONTEXT_TRACE] Attempting to start AudioContext...');
    try {
      await Tone.start();
      console.log(`[CONTEXT_TRACE] AudioContext started successfully. State: ${Tone.context.state}`);
      setIsInitialized(true);
    } catch (e) {
      console.error('[CONTEXT_TRACE] Error starting AudioContext:', e);
    } finally {
      setIsInitializing(false);
    }
  };

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
            {isInitialized 
              ? `AudioContext is ready. State: ${Tone.context.state}`
              : 'Click the button below to initialize the audio context.'
            }
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleStart} disabled={isInitializing || isInitialized} className="w-full text-lg py-6">
            {isInitializing ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <Music className="mr-2 h-6 w-6" />
            )}
            {isInitializing ? 'Initializing...' : isInitialized ? 'Initialized' : 'Start Audio Context'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
