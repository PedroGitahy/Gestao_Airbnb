import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthResults } from "@/lib/metrics";
import { addDays, fmtDateTime, fmtShort, getSettings, money, monthLabel, pct, today } from "@/lib/util";
import { Channel, CleaningPill, PriorityPill, UnitCode } from "@/components/ui";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export default async function Painel() {
  const user = await requireUser("painel");
  const sql = db();
  const d = today();
  const [m, settings, arrivals, departures, cleanings, tickets, next30, sync] = await Promise.all([
    monthResults(d),
    getSettings(),
    sql`SELECT r.id, r.guest_name, r.channel, r.kind, r.check_out, r.portaria_ok, u.code FROM reservations r JOIN units u ON u.id = r.unit_id
        WHERE r.check_in = ${d} AND r.status = 'confirmada' AND r.kind = 'reserva' ORDER BY u.code`,
    sql`SELECT r.id, r.guest_name, r.channel, u.code FROM reservations r JOIN units u ON u.id = r.unit_id
        WHERE r.check_out = ${d} AND r.status = 'confirmada' AND r.kind = 'reserva' ORDER BY u.code`,
    sql`SELECT c.id, c.type, c.status, u.code, us.name AS assignee FROM cleanings c JOIN units u ON u.id = c.unit_id LEFT JOIN users us ON us.id = c.assignee_id
        WHERE c.date = ${d} AND c.status <> 'cancelada' ORDER BY (c.type = 'saida_entrada') DESC, u.code`,
    sql`SELECT t.id, t.title, t.priority, t.due_at, u.code FROM tickets t LEFT JOIN units u ON u.id = t.unit_id
        WHERE t.status <> 'resolvida' ORDER BY t.due_at LIMIT 6`,
    sql`SELECT COALESCE(SUM(LEAST(check_out, ${addDays(d, 30)}::date) - GREATEST(check_in, ${d}::date)), 0)::int AS nights,
          (SELECT count(*) FROM units WHERE active)::int AS units
        FROM reservations WHERE kind = 'reserva' AND status = 'confirmada' AND check_in < ${addDays(d, 30)}::date AND check_out > ${d}::date`,
    sql`SELECT max(ran_at) AS last, bool_and(ok) FILTER (WHERE ran_at > now() - interval '2 hours') AS ok FROM sync_log`,
  ]);

  const t = m.totals;
  const goal = Number(settings.occupancy_goal || 0.7);
  const occ30 = next30[0].units ? next30[0].nights / (next30[0].units * 30) : 0;
  const first = user.name.split(" ")[0];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{greeting()}, {first}.</h1>
          <p>
            {fmtShort(d)} · {arrivals.length} entradas, {departures.length} saídas, {cleanings.filter((c) => c.status !== "vistoriada").length} limpezas em aberto.
          </p>
        </div>
        <div className="actions">
          <Link className="btn" href="/central/calendario">Calendário</Link>
          <Link className="btn btn-primary" href="/central/reservas/nova">Nova reserva</Link>
        </div>
      </div>

      <section className="kpis" aria-label={`Indicadores de ${monthLabel(d)}`}>
        <div className="kpi">
          <span className="k">Ocupação · mês</span>
          <span className="v">{pct(t.occupancy)}</span>
          <div className="meter"><i style={{ width: `${Math.min(100, t.occupancy * 100)}%` }} /></div>
          <span className="s">meta {pct(goal)}</span>
        </div>
        <div className="kpi">
          <span className="k">Próximos 30 dias</span>
          <span className="v">{pct(occ30)}</span>
          <div className="meter"><i style={{ width: `${Math.min(100, occ30 * 100)}%` }} /></div>
          <span className="s">noites já vendidas</span>
        </div>
        <div className="kpi">
          <span className="k">Diária média</span>
          <span className="v">{money(t.adr)}</span>
          <span className="s">RevPAR {money(t.revpar)}</span>
        </div>
        <div className="kpi">
          <span className="k">Receita líquida</span>
          <span className="v">{money(t.net)}</span>
          <span className="s">{monthLabel(d)}</span>
        </div>
        {user.role === "admin" && (
          <div className="kpi">
            <span className="k">Resultado</span>
            <span className="v" style={{ color: t.result < 0 ? "var(--bad)" : undefined }}>{money(t.result)}</span>
            <span className="s">após fixos e custos</span>
          </div>
        )}
        <div className="kpi">
          <span className="k">Nota média</span>
          <span className="v">{t.rating ? t.rating.toFixed(2).replace(".", ",") : "—"}</span>
          <span className="s">meta {settings.rating_goal?.replace(".", ",")}</span>
        </div>
      </section>

      <div className="two-col">
        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Entradas de hoje</h2>
              <Link className="btn-link" href="/central/portaria">Portaria</Link>
            </div>
            {arrivals.length === 0 ? (
              <div className="empty">Nenhuma entrada hoje.</div>
            ) : (
              <div className="list">
                {arrivals.map((r) => (
                  <Link key={r.id} href={`/central/reservas/${r.id}`} className="list-item" style={{ textDecoration: "none" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <UnitCode code={r.code} />
                      <div>
                        <div className="title">{r.guest_name || "Hóspede sem nome"}</div>
                        <div className="meta">sai {fmtShort(r.check_out)} · <Channel channel={r.channel} /></div>
                      </div>
                    </div>
                    {r.portaria_ok ? <span className="pill good">Portaria ok</span> : <span className="pill warn">Cadastrar na portaria</span>}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Limpezas de hoje</h2>
              <Link className="btn-link" href="/central/limpeza">Abrir escala</Link>
            </div>
            {cleanings.length === 0 ? (
              <div className="empty">Nenhuma limpeza programada para hoje.</div>
            ) : (
              <div className="list">
                {cleanings.map((c) => (
                  <div key={c.id} className="list-item">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <UnitCode code={c.code} />
                      <div>
                        <div className="title">{c.type === "saida_entrada" ? "Saída + entrada" : c.type === "saida" ? "Saída" : c.type === "profunda" ? "Profunda" : "Meio de estadia"}</div>
                        <div className="meta">{c.assignee ?? "sem camareira definida"}</div>
                      </div>
                    </div>
                    <CleaningPill status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head">
              <h2>Saídas de hoje</h2>
            </div>
            {departures.length === 0 ? (
              <div className="empty">Nenhuma saída hoje.</div>
            ) : (
              <div className="list">
                {departures.map((r) => (
                  <Link key={r.id} href={`/central/reservas/${r.id}`} className="list-item" style={{ textDecoration: "none" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <UnitCode code={r.code} />
                      <span className="title">{r.guest_name || "Hóspede sem nome"}</span>
                    </div>
                    <Channel channel={r.channel} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Manutenção em aberto</h2>
              <Link className="btn-link" href="/central/manutencao">Ver todas</Link>
            </div>
            {tickets.length === 0 ? (
              <div className="empty">Nada em aberto.</div>
            ) : (
              <div className="list">
                {tickets.map((k) => {
                  const late = new Date(k.due_at) < new Date();
                  return (
                    <div key={k.id} className="list-item">
                      <div>
                        <div className="title">{k.code ? `${k.code} · ` : ""}{k.title}</div>
                        <div className="meta" style={{ color: late ? "var(--bad)" : undefined }}>prazo {fmtDateTime(k.due_at)}</div>
                      </div>
                      <PriorityPill p={k.priority} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="faint" style={{ fontSize: 13, margin: 0 }}>
            {sync[0].last ? `Calendários sincronizados em ${fmtDateTime(sync[0].last)}${sync[0].ok === false ? " · houve erro em algum link" : ""}.` : "Calendários ainda não sincronizados. Cadastre os links iCal em Unidades."}
          </p>
        </div>
      </div>
    </div>
  );
}
