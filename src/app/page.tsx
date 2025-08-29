
'use client';

import { useState } from 'react';
import * as Tone from 'tone';
import { AuraGroove } from '@/components/aura-groove';
import { Button } from '@/components/ui/button';
import Logo from '@/components/icons';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';

export default function Home() {
  const [isStarted, setIsStarted] = useState(false);

  const handleStart = async () => {
    await Tone.start();
    console.log("AudioContext started by user gesture.");
    setIsStarted(true);
  };

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
                 <Button onClick={handleStart} className="w-full text-lg py-6">
                    <Music className="mr-2 h-6 w-6" />
                    Start AuraGroove
                </Button>
            </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <AuraGroove />
    </main>
  );
}
