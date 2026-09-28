import { NextResponse, type NextRequest } from "next/server";
import { agentGuard } from "@/lib/agent";
import { db } from "@/lib/db";
import { PRIORITY } from "@/lib/util";

export const dynamic = "force-dynamic";

/** Abre uma ocorrência de manutenção relatada pelo hóspede ao agente. */
export async function POST(req: NextRequest) {
  const deny = await agentGuard(req);
  if (deny) return deny;
  let body: { unidade?: string; prioridade?: string; titulo?: string; descricao?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ erro: "envie JSON" }, { status: 400 });
  }
  const p = body.prioridade && PRIORITY[body.prioridade] ? body.prioridade : "p2";
  const titulo = (body.titulo ?? "").trim().slice(0, 200);
  if (!titulo) return NextResponse.json({ erro: "titulo é obrigatório" }, { status: 400 });
  const sql = db();
  const [u] = body.unidade ? await sql`SELECT id FROM units WHERE code = ${body.unidade.toUpperCase()} OR apt = ${body.unidade}` : [];
  const due = new Date(Date.now() + PRIORITY[p].hours * 3600_000);
  const [t] = await sql`
    INSERT INTO tickets (unit_id, priority, title, description, assignee, due_at)
    VALUES (${u?.id ?? null}, ${p}, ${titulo}, ${(body.descricao ?? "").slice(0, 2000) || null}, 'Aberto pelo agente de WhatsApp', ${due})
    RETURNING id, due_at`;
  return NextResponse.json({ ok: true, ocorrencia: t.id, prazo: t.due_at });
}
