import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ensureDatabase } from "@/lib/schema";
import { today } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Quantos studios estão livres entre duas datas. Público: devolve só a contagem. */
export async function GET(req: NextRequest) {
  const a = req.nextUrl.searchParams.get("entrada") ?? "";
  const b = req.nextUrl.searchParams.get("saida") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b) || b <= a || a < today()) {
    return NextResponse.json({ erro: "datas inválidas" }, { status: 400 });
  }
  const nights = (Date.parse(b) - Date.parse(a)) / 864e5;
  if (nights > 365) return NextResponse.json({ erro: "período longo demais" }, { status: 400 });
  await ensureDatabase();
  const [r] = await db()`
    SELECT count(*)::int AS livres FROM units u
    WHERE u.active AND NOT EXISTS (
      SELECT 1 FROM reservations r WHERE r.unit_id = u.id AND r.status = 'confirmada'
        AND r.check_in < ${b}::date AND r.check_out > ${a}::date)`;
  return NextResponse.json({ livres: r.livres, noites: nights }, { headers: { "Cache-Control": "no-store" } });
}
