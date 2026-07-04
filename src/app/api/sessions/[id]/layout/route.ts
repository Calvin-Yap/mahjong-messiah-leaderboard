import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const LayoutSchema = z.object({
  tables: z.record(z.string(), z.array(z.string())), // tableNumber -> playerIds
  sideline: z.array(z.string()),
});

// PATCH /api/sessions/:id/layout — called on every drag-drop (lightweight
// write path, mirrors saveSessionLayout() in session_backend.gs).
//
// TODO(realtime): after persisting, broadcast the new layout on a
// Supabase Realtime channel scoped to this session id so every device
// with the session page open updates without polling. Something like:
//   supabase.channel(`session:${sessionId}`).send({ type: 'broadcast', event: 'layout', payload })
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { tables, sideline } = LayoutSchema.parse(await req.json());

  await prisma.$transaction([
    prisma.sessionTable.deleteMany({ where: { sessionId: params.id } }),
    prisma.sessionSideline.deleteMany({ where: { sessionId: params.id } }),
    prisma.sessionTable.createMany({
      data: Object.entries(tables).flatMap(([tableNumber, playerIds]) =>
        playerIds.map((playerId, i) => ({
          sessionId: params.id,
          tableNumber: Number(tableNumber),
          seatPosition: i + 1,
          playerId,
        }))
      ),
    }),
    prisma.sessionSideline.createMany({
      data: sideline.map((playerId) => ({ sessionId: params.id, playerId })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
