import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, money, PRIORITY } from "@/lib/util";
import { Flash, PriorityPill, TicketPill } from "@/components/ui";
import { createTicket, updateTicket } from "../../actions";

export default async function Manutencao({ searchParams }: { searchParams: Promise<{ v?: string; ok?: string; erro?: string }> }) {
  const user = await requireUser("manutencao");
  const sp = await searchParams;
  const view = sp.v === "resolvidas" ? "resolvidas" : "abertas";
  const sql = db();
  const canManage = user.role !== "camareira";

  const [rows, units] = await Promise.all([
    view === "abertas"
      ? sql`SELECT t.*, u.code, us.name AS opener FROM tickets t LEFT JOIN units u ON u.id = t.unit_id LEFT JOIN users us ON us.id = t.opened_by
            WHERE t.status <> 'resolvida' ORDER BY t.due_at`
      : sql`SELECT t.*, u.code, us.name AS opener FROM tickets t LEFT JOIN units u ON u.id = t.unit_id LEFT JOIN users us ON us.id = t.opened_by
            WHERE t.status = 'resolvida' ORDER BY t.resolved_at DESC LIMIT 100`,
    sql`SELECT id, code FROM units WHERE active ORDER BY code`,
  ]);
  const now = new Date();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Manutenção</h1>
          <p>O prazo é calculado pela prioridade: P1 em 2h, P2 em 12h, P3 em 48h, preventiva em 7 dias.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <div className="two-col">
        <div>
          <div className="filters">
            <Link href="/central/manutencao" aria-current={view === "abertas" ? "true" : undefined}>Em aberto</Link>
            <Link href="/central/manutencao?v=resolvidas" aria-current={view === "resolvidas" ? "true" : undefined}>Resolvidas</Link>
          </div>
          <div className="panel">
            {rows.length === 0 ? (
              <div className="empty">{view === "abertas" ? "Nenhuma ocorrência em aberto." : "Nenhuma ocorrência resolvida ainda."}</div>
            ) : (
              <div className="list">
                {rows.map((t) => {
                  const late = t.status !== "resolvida" && new Date(t.due_at) < now;
                  return (
                    <div key={t.id} className="list-item" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                        <div className="title">{t.code ? `${t.code} · ` : "Área comum · "}{t.title}</div>
                        {t.description && <div className="meta">{t.description}</div>}
                        <div className="meta">
                          #{t.id} · aberta por {t.opener ?? "—"} em {fmtDateTime(t.opened_at)}
                          {t.status === "resolvida" ? ` · resolvida em ${fmtDateTime(t.resolved_at)}${t.cost ? ` · ${money(t.cost)}` : ""}` : ` · prazo ${fmtDateTime(t.due_at)}`}
                          {t.assignee ? ` · ${t.assignee}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <PriorityPill p={t.priority} />
                          <TicketPill status={t.status} overdue={late} />
                        </div>
                        {canManage && t.status !== "resolvida" && (
                          <form action={updateTicket} style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <input type="hidden" name="id" value={t.id} />
                            {t.status === "aberta" && <button className="btn btn-small" name="status" value="em_andamento">Assumir</button>}
                            <input name="cost" inputMode="decimal" placeholder="Custo R$" aria-label="Custo" style={{ width: 100, padding: "6px 8px", fontSize: 13 }} />
                            <button className="btn btn-primary btn-small" name="status" value="resolvida">Resolver</button>
                          </form>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <section className="panel">
          <div className="panel-head"><h2>Abrir ocorrência</h2></div>
          <form action={createTicket} className="form panel-body">
            <div className="grid-2">
              <div className="field">
                <label htmlFor="t-unit">Unidade</label>
                <select id="t-unit" name="unit_id" defaultValue="">
                  <option value="">Área comum</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="t-prio">Prioridade</label>
                <select id="t-prio" name="priority" defaultValue="p3">
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="t-title">O que aconteceu</label>
              <input id="t-title" name="title" required placeholder="Ex.: ar-condicionado não gela" />
            </div>
            <div className="field">
              <label htmlFor="t-desc">Detalhes</label>
              <textarea id="t-desc" name="description" placeholder="Desde quando, se há hóspede na unidade, o que já foi tentado" />
            </div>
            <div className="field">
              <label htmlFor="t-who">Responsável</label>
              <input id="t-who" name="assignee" placeholder="Técnico ou fornecedor" />
            </div>
            <div><button className="btn btn-primary" type="submit">Abrir</button></div>
          </form>
        </section>
      </div>
    </div>
  );
}
