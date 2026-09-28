import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureDatabase } from "@/lib/schema";
import { buildIcal } from "@/lib/ical";
import { addDays, today } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Calendário de saída de uma unidade, para o Airbnb e o Booking importarem. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const para = req.nextUrl.searchParams.get("para");
  await ensureDatabase();
  const sql = db();
  const [u] = await sql`SELECT id, code FROM units WHERE ical_token = ${token}`;
  if (!u) return new NextResponse("Não encontrado", { status: 404 });
  const rows = await sql`
    SELECT id, check_in, check_out, channel FROM reservations
    WHERE unit_id = ${u.id} AND status = 'confirmada' AND check_out >= ${addDays(today(), -1)}::date
      ${para === "airbnb" || para === "booking" ? sql`AND channel <> ${para}` : sql``}
    ORDER BY check_in`;
  return new NextResponse(buildIcal(u.code, rows as never), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
