import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { DialogProvider } from '@/components/dialogs';

export const metadata: Metadata = { title: 'Controle das Escolas' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><DialogProvider>{children}</DialogProvider></body>
    </html>
  );
}
