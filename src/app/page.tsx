
'use client';

import { useAuraGrooveLite } from '@/hooks/use-aura-groove';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';
import Image from 'next/image';
import LoadingDots from '@/components/ui/loading-dots';

export default function Home() {
  const { 
    handleStart, 
    isInitializing, 
    isInitialized, 
    buttonText, 
    infoText 
  } = useAuraGrooveLite();

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
            {infoText}
          </p>
          {isInitializing && <LoadingDots />}
        </CardContent>
        <CardFooter>
          <Button onClick={handleStart} disabled={isInitializing} className="w-full text-lg py-6">
            {!isInitializing && <Music className="mr-2 h-6 w-6" />}
            {buttonText}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
