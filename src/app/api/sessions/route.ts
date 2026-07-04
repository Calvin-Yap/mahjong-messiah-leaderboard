import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const CreateSessionSchema = z.object({
  tableCount: z.number().int().min(1).max(10).default(2),
});

// GET /api/sessions?active=true — used on session page load to resume
// today's session (mirrors getSessionInitData() in session_backend.gs)
export async function GET(req: NextRequest) {
  const active = req.nextUrl.searchParams.get('active') === 'true';
  const session = await prisma.session.findFirst({
    where: active ? { active: true } : undefined,
    orderBy: { startedAt: 'desc' },
    include: {
      tables: { include: { player: true } },
      sideline: { include: { player: true } },
    },
  });
  return NextResponse.json(session);
}

// POST /api/sessions — "Open Session" button
export async function POST(req: NextRequest) {
  const { tableCount } = CreateSessionSchema.parse(await req.json());
  const session = await prisma.session.create({ data: { tableCount } });
  return NextResponse.json(session, { status: 201 });
}
