import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { DialogProvider } from '@/components/dialogs';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600'] });
const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = { title: 'Controle das Escolas' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`}>
      <body><DialogProvider>{children}</DialogProvider></body>
    </html>
  );
}
