import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NavBar } from '@/components/ui/NavBar';

export const metadata: Metadata = {
  title: "Ken's Mahjong Club",
  description: 'Session manager, leaderboard, and ELO ratings for the club.',
  manifest: '/manifest.json',
  // TODO(pwa): add icons (192/512) once branding is finalized, e.g.
  // icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#667eea',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
