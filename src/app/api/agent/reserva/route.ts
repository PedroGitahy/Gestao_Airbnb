import { NextResponse, type NextRequest } from "next/server";
import { agentGuard } from "@/lib/agent";
import { db } from "@/lib/db";
import { syncAll } from "@/lib/ical";
import { planMessages } from "@/lib/messages";

export const dynamic = "force-dynamic";

type Body = {
  codigo?: string;
  unidade?: string;
  canal?: "airbnb" | "booking" | "direto";
  entrada?: string;
  saida?: string;
  hospede?: string;
  telefone?: string;
  email?: string;
  pessoas?: number;
  valor?: number;
  taxa_limpeza?: number;
  taxa_plataforma?: number;
  observacoes?: string;
};

const iso = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const n = (v: unknown) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

async function find(b: Body) {
  const sql = db();
  if (b.codigo) {
    const [r] = await sql`SELECT id FROM reservations WHERE upper(confirmation_code) = ${b.codigo.toUpperCase().trim()} ORDER BY id DESC LIMIT 1`;
    if (r) return r.id as number;
  }
  if (b.unidade && iso(b.entrada) && iso(b.saida)) {
    const [r] = await sql`
      SELECT r.id FROM reservations r JOIN units u ON u.id = r.unit_id
      WHERE (u.code = ${b.unidade.toUpperCase()} OR u.apt = ${b.unidade}) AND r.check_in = ${iso(b.entrada)} AND r.check_out = ${iso(b.saida)}
        AND r.status = 'confirmada' ${b.canal ? sql`AND r.channel = ${b.canal}` : sql``}
      ORDER BY r.id DESC LIMIT 1`;
    if (r) return r.id as number;
  }
  return null;
}

/**
 * Completa uma reserva com os dados do e-mail de confirmação (lido pelo n8n):
 * procura pelo código (HM... do Airbnb) ou por unidade + datas.
 * Só preenche o que vier no corpo; o resto fica como está.
 */
export async function POST(req: NextRequest) {
  const deny = await agentGuard(req);
  if (deny) return deny;
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ erro: "envie JSON" }, { status: 400 });
  }
  if (!b.codigo && !(b.unidade && b.entrada && b.saida)) {
    return NextResponse.json({ erro: "informe codigo, ou unidade + entrada + saida" }, { status: 400 });
  }

  let id = await find(b);
  if (!id) {
    // a reserva pode ter chegado por e-mail antes da próxima sincronização
    await syncAll();
    id = await find(b);
  }
  if (!id) return NextResponse.json({ encontrado: false, dica: "reserva ainda não está no calendário; tente de novo em alguns minutos" }, { status: 404 });

  const sql = db();
  const fee = n(b.taxa_plataforma);
  await sql`
    UPDATE reservations SET
      guest_name = COALESCE(${b.hospede?.trim() || null}, guest_name),
      guest_phone = COALESCE(${b.telefone?.trim() || null}, guest_phone),
      guest_email = COALESCE(${b.email?.trim() || null}, guest_email),
      guests_count = COALESCE(${n(b.pessoas)}, guests_count),
      gross = COALESCE(${n(b.valor)}, gross),
      cleaning_fee = COALESCE(${n(b.taxa_limpeza)}, cleaning_fee),
      platform_fee_pct = COALESCE(${fee === null ? null : fee > 1 ? fee / 100 : fee}, platform_fee_pct),
      confirmation_code = COALESCE(confirmation_code, ${b.codigo?.toUpperCase() ?? null}),
      notes = CASE WHEN ${b.observacoes ?? null}::text IS NULL THEN notes ELSE concat_ws(E'\n', notes, ${b.observacoes ?? null}::text) END,
      updated_at = now()
    WHERE id = ${id}`;
  await planMessages();
  const [r] = await sql`SELECT r.id, u.code, r.guest_name, r.check_in, r.check_out, r.gross FROM reservations r JOIN units u ON u.id = r.unit_id WHERE r.id = ${id}`;
  return NextResponse.json({ ok: true, reserva: r });
}
