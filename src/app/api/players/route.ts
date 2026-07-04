import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const CreatePlayerSchema = z.object({
  name: z.string().trim().min(1, 'Player name cannot be empty.'),
  icon: z.string().trim().min(1, 'Please select or enter an icon.'),
});

// GET /api/players — list all active players (for pickers, session setup)
export async function GET() {
  const players = await prisma.player.findMany({
    where: { archived: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, icon: true },
  });
  return NextResponse.json(players);
}

// POST /api/players — Add New Player (see AddPlayerModal.tsx for the UI)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreatePlayerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }
  const { name, icon } = parsed.data;

  const existingName = await prisma.player.findUnique({ where: { name } });
  if (existingName) {
    return NextResponse.json(
      { error: 'A player with that name already exists.' },
      { status: 409 }
    );
  }

  // TODO(icon dedupe): the original sheet also blocked duplicate emoji icons
  // across players — decide if that rule still matters at web-app scale,
  // and if so check `icon` uniqueness here too (skip for uploaded images).

  const player = await prisma.player.create({
    data: { name, icon },
  });

  // Seed matching ELO state row at the starting rating.
  await prisma.eloState.create({
    data: { playerId: player.id },
  });

  return NextResponse.json(player, { status: 201 });
}
