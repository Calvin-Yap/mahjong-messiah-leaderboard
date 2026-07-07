import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UpdatePlayerSchema = z.object({
  archived: z.boolean().optional(),
});

// PATCH /api/players/:id — currently just the "left the club" archive
// toggle. This is a SOFT delete (archived: true), never a real row
// delete: a real delete would either fail (players are referenced by
// games/game_scores/elo_history with no cascade — intentional, so a
// mistaken player delete can't silently wipe game history) or, if forced,
// would corrupt every past game's results. `archived: false` players are
// simply excluded from the roster (/api/players) and leaderboard/
// dashboard/network aggregations going forward — their historical rows
// are untouched.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = UpdatePlayerSchema.parse(await req.json());

  const player = await prisma.player.update({ where: { id }, data: body });
  return NextResponse.json(player);
}
