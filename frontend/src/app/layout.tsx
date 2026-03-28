import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CrisisBanner } from '@/components/layout/crisis-banner';
import { Toaster } from 'sonner';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export const metadata: Metadata = {
  title: {
    default: 'ReflectAI — Private Emotion Journaling',
    template: '%s | ReflectAI',
  },
  description:
    'Privacy-first emotional journaling with AI-powered pattern insights. Not a substitute for therapy.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body>
        <CrisisBanner />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              fontSize: '14px',
            },
          }}
          richColors
        />
      </body>
    </html>
  );
}
