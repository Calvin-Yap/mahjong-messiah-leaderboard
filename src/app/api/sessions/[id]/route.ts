import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const UpdateSessionSchema = z.object({
  tableCount: z.number().int().min(1).max(10).optional(),
  active: z.boolean().optional(),
});

// PATCH /api/sessions/:id — "Add Table" button (tableCount++) and
// "Close Session" (active: false). Next.js 16 requires params to be
// awaited (see the README's Next.js 16 upgrade note).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = UpdateSessionSchema.parse(await req.json());

  const updated = await prisma.session.update({
    where: { id },
    data: {
      ...body,
      endedAt: body.active === false ? new Date() : undefined,
    },
  });
  return NextResponse.json(updated);
}
