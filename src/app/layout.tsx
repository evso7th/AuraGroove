
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AudioEngineProvider } from '@/contexts/audio-engine-context';

export const metadata: Metadata = {
  title: 'AuraGroove',
  description: 'AI-powered ambient music generator',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <AudioEngineProvider>
            {children}
        </AudioEngineProvider>
        <Toaster />
        {/* Add the hidden iframe for the rhythm section here */}
        <iframe id="rhythm-frame" src="/rhythm-frame.html" style={{ display: 'none' }} title="Rhythm Engine"></iframe>
      </body>
    </html>
  );
}
