import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, fmtShort, money, today } from "@/lib/util";
import { Channel, Flash, UnitCode } from "@/components/ui";
import { syncNow } from "../../actions";

const VIEWS = [
  { key: "proximas", label: "Próximas" },
  { key: "hospedados", label: "Hospedados agora" },
  { key: "passadas", label: "Passadas" },
  { key: "incompletas", label: "Sem valor ou hóspede" },
  { key: "canceladas", label: "Canceladas" },
];

export default async function Reservas({ searchParams }: { searchParams: Promise<{ v?: string; ok?: string; erro?: string; q?: string }> }) {
  await requireUser("reservas");
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.v) ? sp.v! : "proximas";
  const q = (sp.q ?? "").trim();
  const d = today();
  const sql = db();

  const where = {
    proximas: sql`r.status = 'confirmada' AND r.check_in >= ${d}::date AND r.check_in < ${addDays(d, 120)}::date`,
    hospedados: sql`r.status = 'confirmada' AND r.check_in <= ${d}::date AND r.check_out > ${d}::date`,
    passadas: sql`r.status = 'confirmada' AND r.check_out <= ${d}::date AND r.check_out > ${addDays(d, -120)}::date`,
    incompletas: sql`r.status = 'confirmada' AND r.kind = 'reserva' AND (r.gross IS NULL OR r.guest_name IS NULL) AND r.check_out > ${addDays(d, -60)}::date`,
    canceladas: sql`r.status = 'cancelada' AND r.check_in > ${addDays(d, -120)}::date`,
  }[view]!;
  const search = q ? sql`AND (r.guest_name ILIKE ${"%" + q + "%"} OR u.code ILIKE ${"%" + q + "%"})` : sql``;
  const order = view === "passadas" || view === "canceladas" ? sql`r.check_in DESC` : sql`r.check_in, u.code`;

  const rows = await sql`
    SELECT r.*, u.code, (r.check_out - r.check_in) AS nights
    FROM reservations r JOIN units u ON u.id = r.unit_id
    WHERE ${where} ${search}
    ORDER BY ${order}
    LIMIT 300`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reservas</h1>
          <p>O calendário do Airbnb e do Booking entra sozinho. Complete hóspede e valores aqui.</p>
        </div>
        <div className="actions">
          <form action={syncNow}><button className="btn" type="submit">Sincronizar agora</button></form>
          <Link className="btn btn-primary" href="/central/reservas/nova">Nova reserva</Link>
        </div>
      </div>
      <Flash sp={sp} />
      <div className="filters">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/central/reservas?v=${v.key}`} aria-current={v.key === view ? "true" : undefined}>{v.label}</Link>
        ))}
        <form style={{ marginLeft: "auto" }}>
          <input type="hidden" name="v" value={view} />
          <input name="q" id="q" defaultValue={q} placeholder="Buscar hóspede ou unidade" aria-label="Buscar" style={{ width: 230 }} />
        </form>
      </div>
      <div className="panel table-wrap">
        <table className="t">
          <thead>
            <tr>
              <th>Unidade</th>
              <th>Hóspede</th>
              <th>Canal</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th className="num">Noites</th>
              <th className="num">Valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="empty">Nenhuma reserva nesta lista.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td><UnitCode code={r.code} /></td>
                <td>
                  <Link className="row-link" href={`/central/reservas/${r.id}`}>
                    {r.kind === "bloqueio" ? "Bloqueio de datas" : r.guest_name || "Completar dados"}
                  </Link>
                </td>
                <td><Channel channel={r.channel} kind={r.kind} /></td>
                <td>{fmtShort(r.check_in)}</td>
                <td>{fmtShort(r.check_out)}</td>
                <td className="num">{r.nights}</td>
                <td className="num">{r.gross ? money(r.gross) : <span className="faint">—</span>}</td>
                <td>{r.source === "ical" ? <span className="pill">iCal</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
