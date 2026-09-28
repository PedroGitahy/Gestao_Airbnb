import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/lib/auth";
import { can } from "@/lib/roles";
import { db } from "@/lib/db";
import { monthResults } from "@/lib/metrics";
import { addDays, monthEnd, monthStart, today } from "@/lib/util";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")) : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u || !can(u.role, "financeiro")) return new NextResponse("Sem acesso", { status: 403 });
  const mes = req.nextUrl.searchParams.get("mes");
  const base = mes && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : monthStart(today());
  const m = await monthResults(base);
  const sql = db();
  const res = await sql`
    SELECT r.id, u.code, r.channel, r.guest_name, r.check_in, r.check_out, r.gross, r.platform_fee_pct, r.cleaning_fee
    FROM reservations r JOIN units u ON u.id = r.unit_id
    WHERE r.kind = 'reserva' AND r.status = 'confirmada' AND r.check_in >= ${base}::date AND r.check_in < ${addDays(monthEnd(base), 1)}::date
    ORDER BY r.check_in`;
  const exp = await sql`
    SELECT e.date, u.code, e.category, e.description, e.supplier, e.amount FROM expenses e LEFT JOIN units u ON u.id = e.unit_id
    WHERE e.date >= ${base}::date AND e.date < ${addDays(monthEnd(base), 1)}::date ORDER BY e.date`;

  const lines: string[] = [];
  lines.push(`Resultado por unidade;${base.slice(0, 7)}`);
  lines.push("Unidade;Noites;Receita bruta;Receita líquida;Fixos;Custos;Resultado");
  for (const x of m.units) lines.push([x.code, x.nights, x.gross, x.net, x.fixed, x.variable, x.result].map(cell).join(";"));
  lines.push("");
  lines.push("Reservas com entrada no mês");
  lines.push("ID;Unidade;Canal;Hóspede;Entrada;Saída;Valor;Taxa %;Limpeza");
  for (const r of res) lines.push([r.id, r.code, r.channel, r.guest_name, r.check_in, r.check_out, r.gross === null ? null : Number(r.gross), r.platform_fee_pct === null ? null : Number(r.platform_fee_pct) * 100, r.cleaning_fee === null ? null : Number(r.cleaning_fee)].map(cell).join(";"));
  lines.push("");
  lines.push("Custos");
  lines.push("Data;Unidade;Categoria;Descrição;Fornecedor;Valor");
  for (const e of exp) lines.push([e.date, e.code ?? "Geral", e.category, e.description, e.supplier, Number(e.amount)].map(cell).join(";"));

  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rgr-artem-${base.slice(0, 7)}.csv"`,
    },
  });
}
