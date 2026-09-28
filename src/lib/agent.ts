import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ensureDatabase } from "./schema";

/** Autoriza chamadas do agente de IA (n8n) pelo cabeçalho Authorization: Bearer <AGENT_API_KEY>. */
export async function agentGuard(req: NextRequest): Promise<NextResponse | null> {
  const key = process.env.AGENT_API_KEY;
  if (!key || key.length < 24) return NextResponse.json({ erro: "AGENT_API_KEY não configurada no servidor" }, { status: 503 });
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got);
  const b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  await ensureDatabase();
  return null;
}
