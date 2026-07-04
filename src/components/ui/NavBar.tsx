'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const LINKS = [
  { href: '/session', label: '🀄 Session' },
  { href: '/leaderboard', label: '🏆 Leaderboard' },
  { href: '/dashboard', label: '📊 Dashboard' },
  { href: '/network', label: '🌐 Network' },
  { href: '/hall-of-fame', label: '🏛️ Hall of Fame' },
];

// TODO(mobile): collapse into a bottom tab bar below `sm` breakpoint —
// a top nav with 4 text links is the least mobile-friendly part of this
// shell and should be the first thing revisited in the mobile polish pass.
export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <span className="text-sm font-extrabold text-ink-900">🀄 Mahjong Club</span>
        <nav className="flex gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'rounded-full px-3 py-1.5 text-sm font-semibold transition',
                pathname?.startsWith(link.href)
                  ? 'bg-brand-500 text-white'
                  : 'text-ink-500 hover:bg-brand-50 hover:text-ink-900'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
