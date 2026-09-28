import { NextResponse, type NextRequest } from "next/server";
import { agentGuard } from "@/lib/agent";
import { db } from "@/lib/db";
import { today } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Resumo do dia para o agente: entradas, saídas, limpezas e ocorrências abertas. */
export async function GET(req: NextRequest) {
  const deny = await agentGuard(req);
  if (deny) return deny;
  const d = req.nextUrl.searchParams.get("data") ?? today();
  const sql = db();
  const [entradas, saidas, limpezas, ocorrencias] = await Promise.all([
    sql`SELECT u.code AS unidade, u.apt, r.guest_name AS hospede, r.guests_count AS pessoas, r.check_out AS saida, r.channel AS canal, r.portaria_ok
        FROM reservations r JOIN units u ON u.id = r.unit_id WHERE r.check_in = ${d} AND r.status = 'confirmada' AND r.kind = 'reserva' ORDER BY u.code`,
    sql`SELECT u.code AS unidade, r.guest_name AS hospede FROM reservations r JOIN units u ON u.id = r.unit_id
        WHERE r.check_out = ${d} AND r.status = 'confirmada' AND r.kind = 'reserva' ORDER BY u.code`,
    sql`SELECT u.code AS unidade, c.type AS tipo, c.status, us.name AS camareira FROM cleanings c JOIN units u ON u.id = c.unit_id
        LEFT JOIN users us ON us.id = c.assignee_id WHERE c.date = ${d} AND c.status <> 'cancelada' ORDER BY u.code`,
    sql`SELECT t.id, u.code AS unidade, t.priority AS prioridade, t.title AS titulo, t.due_at AS prazo, t.status
        FROM tickets t LEFT JOIN units u ON u.id = t.unit_id WHERE t.status <> 'resolvida' ORDER BY t.due_at`,
  ]);
  return NextResponse.json({ data: d, entradas, saidas, limpezas, ocorrencias });
}
