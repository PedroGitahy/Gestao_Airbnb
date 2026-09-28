import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, diffDays, fmtShort, monthEnd, monthLabel, monthStart, shiftMonth, today, weekday } from "@/lib/util";

export default async function Calendario({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const user = await requireUser("calendario");
  const sp = await searchParams;
  const base = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : monthStart(today());
  const start = base;
  const endExcl = addDays(monthEnd(base), 1);
  const days = diffDays(start, endExcl);
  const d0 = today();

  const sql = db();
  const [units, res] = await Promise.all([
    sql`SELECT id, code FROM units WHERE active ORDER BY code`,
    sql`SELECT id, unit_id, channel, kind, guest_name, check_in, check_out FROM reservations
        WHERE status = 'confirmada' AND check_in < ${endExcl}::date AND check_out > ${start}::date`,
  ]);

  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const COL = 34;
  const canOpen = user.role === "admin" || user.role === "atendimento";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{monthLabel(start)}</h1>
          <p>Ocupação das {units.length} unidades. Cada barra vai do check-in ao check-out.</p>
        </div>
        <div className="actions">
          <Link className="btn" href={`/central/calendario?mes=${shiftMonth(start, -1).slice(0, 7)}`} aria-label="Mês anterior">←</Link>
          <Link className="btn" href="/central/calendario">Hoje</Link>
          <Link className="btn" href={`/central/calendario?mes=${shiftMonth(start, 1).slice(0, 7)}`} aria-label="Próximo mês">→</Link>
        </div>
      </div>

      <div className="cal">
        <div className="cal-grid" style={{ ["--days" as string]: days }}>
          <div className="cal-head">
            <div style={{ position: "sticky", left: 0, zIndex: 3 }} />
            {dates.map((d) => {
              const wk = ["sáb", "dom"].includes(weekday(d));
              return (
                <div key={d} className={`${d === d0 ? "today" : ""} ${wk ? "wk" : ""}`}>
                  {weekday(d)}
                  <b>{Number(d.slice(8))}</b>
                </div>
              );
            })}
          </div>
          {units.map((u) => (
            <div className="cal-row" key={u.id}>
              <div className="cal-unit">{u.code}</div>
              {dates.map((d) => (
                <div key={d} className={`cal-cell ${d === d0 ? "today" : ""} ${["sáb", "dom"].includes(weekday(d)) ? "wk" : ""}`} />
              ))}
              {res
                .filter((r) => r.unit_id === u.id)
                .map((r) => {
                  // meia célula no check-in e no check-out, como no calendário das plataformas
                  const from = Math.max(diffDays(start, r.check_in) + 0.5, 0);
                  const to = Math.min(diffDays(start, r.check_out) + 0.5, days);
                  const left = 76 + from * COL + 2;
                  const width = Math.max((to - from) * COL - 4, 10);
                  const label = r.kind === "bloqueio" ? "Bloqueio" : r.guest_name || (r.channel === "airbnb" ? "Airbnb" : r.channel === "booking" ? "Booking" : "Reserva");
                  const cls = `cal-bar ${r.kind === "bloqueio" ? "bloqueio" : r.channel}`;
                  const title = `${u.code} · ${label} · ${fmtShort(r.check_in)} → ${fmtShort(r.check_out)}`;
                  return canOpen ? (
                    <Link key={r.id} href={`/central/reservas/${r.id}`} className={cls} style={{ left, width }} title={title}>{label}</Link>
                  ) : (
                    <span key={r.id} className={cls} style={{ left, width }} title={title}>{label}</span>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      <div className="legend">
        <span className="ch airbnb">Airbnb</span>
        <span className="ch booking">Booking</span>
        <span className="ch direto">Direto</span>
        <span className="ch bloqueio">Bloqueio</span>
      </div>
    </div>
  );
}
