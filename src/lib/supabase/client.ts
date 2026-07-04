'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Used for:
 *  - Realtime subscriptions (live session table updates across devices)
 *  - Uploading player icon images to Supabase Storage
 *
 * All *data* reads/writes for players/games/leaderboard go through our
 * own Next.js API routes (backed by Prisma) — Supabase here is only for
 * Realtime + Storage, keeping one source of truth for query logic.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
