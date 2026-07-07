import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionStateDTO, PlayerDTO } from "@/lib/types";

const CreateSessionSchema = z.object({
  tableCount: z.number().int().min(1).max(10).default(2),
});

function toDTO(session: {
  id: string;
  active: boolean;
  tableCount: number;
  tables: { tableNumber: number; player: PlayerDTO }[];
  sideline: { player: PlayerDTO }[];
}): SessionStateDTO {
  const tablesByNumber = new Map<number, PlayerDTO[]>();
  for (let i = 1; i <= session.tableCount; i++) tablesByNumber.set(i, []);
  session.tables.forEach((row) => {
    const arr = tablesByNumber.get(row.tableNumber) ?? [];
    arr.push(row.player);
    tablesByNumber.set(row.tableNumber, arr);
  });

  return {
    id: session.id,
    active: session.active,
    tableCount: session.tableCount,
    tables: Array.from(tablesByNumber.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([tableNumber, players]) => ({ tableNumber, players })),
    sideline: session.sideline.map((s) => s.player),
  };
}

// GET /api/sessions?active=true — used on session page load to resume
// today's session (mirrors getSessionInitData() in session_backend.gs).
// Always returns the shaped SessionStateDTO (or null if none exists) so
// the page never has to deal with raw Prisma relation shapes.
export async function GET(req: NextRequest) {
  const active = req.nextUrl.searchParams.get("active") === "true";
  const session = await prisma.session.findFirst({
    where: active ? { active: true } : undefined,
    orderBy: { startedAt: "desc" },
    include: {
      tables: {
        include: { player: { select: { id: true, name: true, icon: true } } },
        orderBy: { seatPosition: "asc" },
      },
      sideline: {
        include: { player: { select: { id: true, name: true, icon: true } } },
      },
    },
  });
  return NextResponse.json(session ? toDTO(session) : null);
}

// POST /api/sessions — "Start Session" button (empty state on /session)
export async function POST(req: NextRequest) {
  const { tableCount } = CreateSessionSchema.parse(await req.json());
  const existingActive = await prisma.session.findFirst({
    where: { active: true },
  });
  if (existingActive) {
    return NextResponse.json(
      { error: "A session is already active." },
      { status: 409 },
    );
  }
  const session = await prisma.session.create({ data: { tableCount } });
  return NextResponse.json(toDTO({ ...session, tables: [], sideline: [] }), {
    status: 201,
  });
}
