
'use client';

import { useAuraGrooveLite } from '@/hooks/use-aura-groove';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';
import Image from 'next/image';
import LoadingDots from '@/components/ui/loading-dots';
import { useLanguage } from '@/contexts/language-context';
import { LanguageSwitcher } from '@/components/ui/language-switcher';


export default function Home() {
  const { dictionary: dict, loading: langLoading } = useLanguage();

  const { 
    handleStart, 
    isInitializing, 
    isInitialized, 
  } = useAuraGrooveLite();

  if (langLoading || !dict) {
    return <div className="flex min-h-screen flex-col items-center justify-center"><LoadingDots /></div>;
  }

  const buttonText = isInitializing 
    ? dict.home.initializing 
    : (isInitialized ? dict.home.enter : dict.home.start);
  
  const infoText = isInitializing 
    ? dict.home.infoInitializing 
    : (isInitialized 
        ? dict.home.infoReady 
        : dict.home.infoNotReady);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-lg shadow-2xl text-center">
        <CardHeader>
           <div className="absolute top-4 right-4">
              <LanguageSwitcher />
           </div>
          <div className="mx-auto mb-4">
            <Image src="/assets/icon8.jpeg" alt="AuraGroove Logo" width={80} height={80} className="rounded-full" />
          </div>
          <CardTitle className="font-headline text-4xl">{dict.home.title}</CardTitle>
          <CardDescription className="text-lg">{dict.home.description}</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[60px] flex flex-col items-center justify-center">
          <p className="text-muted-foreground min-h-[20px]">
            {infoText}
          </p>
          {isInitializing && <LoadingDots />}
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button onClick={handleStart} disabled={isInitializing} className="w-full text-lg py-6">
            {!isInitializing && <Music className="mr-2 h-6 w-6" />}
            {buttonText}
          </Button>
          <p className="text-xs text-muted-foreground pt-2">
            {dict.home.footer('')}
            <a 
              href="https://polyankastudio.ru/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              {dict.home.studio}
            </a>
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
