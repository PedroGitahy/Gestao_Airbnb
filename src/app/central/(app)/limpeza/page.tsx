import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, CLEANING_TYPE, fmtShort, today, weekday } from "@/lib/util";
import { CleaningPill, Flash } from "@/components/ui";
import { assignCleaning, createCleaning, setCleaningStatus } from "../../actions";

export default async function Limpeza({ searchParams }: { searchParams: Promise<{ data?: string; ok?: string; erro?: string }> }) {
  const user = await requireUser("limpeza");
  const sp = await searchParams;
  const d0 = today();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : d0;
  const isCam = user.role === "camareira";
  const sql = db();

  const [rows, staff, units, counts] = await Promise.all([
    sql`
      SELECT c.*, u.code, us.name AS assignee_name, ck.name AS checked_name,
        (SELECT n.guest_name FROM reservations n WHERE n.unit_id = c.unit_id AND n.check_in = c.date AND n.status = 'confirmada' AND n.kind = 'reserva' LIMIT 1) AS next_guest,
        (SELECT n.check_out FROM reservations n WHERE n.unit_id = c.unit_id AND n.check_in = c.date AND n.status = 'confirmada' AND n.kind = 'reserva' LIMIT 1) AS next_out
      FROM cleanings c
      JOIN units u ON u.id = c.unit_id
      LEFT JOIN users us ON us.id = c.assignee_id
      LEFT JOIN users ck ON ck.id = c.checked_by
      WHERE c.date = ${date} AND c.status <> 'cancelada'
        ${isCam ? sql`AND (c.assignee_id = ${user.id} OR c.assignee_id IS NULL)` : sql``}
      ORDER BY (c.type = 'saida_entrada') DESC, (c.status = 'vistoriada'), u.code`,
    isCam ? Promise.resolve([]) : sql`SELECT id, name FROM users WHERE active AND role IN ('camareira','governanca') ORDER BY name`,
    isCam ? Promise.resolve([]) : sql`SELECT id, code FROM units WHERE active ORDER BY code`,
    sql`SELECT date, count(*)::int AS n FROM cleanings WHERE date >= ${d0}::date AND date < ${addDays(d0, 7)}::date AND status NOT IN ('cancelada','vistoriada') GROUP BY date`,
  ]);

  const byDate = Object.fromEntries(counts.map((c) => [c.date, c.n]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(d0, i));
  const done = rows.filter((r) => r.status === "vistoriada").length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Limpeza</h1>
          <p>
            {weekday(date)}, {fmtShort(date)} · {rows.length} {rows.length === 1 ? "unidade" : "unidades"}, {done} liberadas.
            {!isCam && " A unidade só volta a ser vendável depois da vistoria."}
          </p>
        </div>
      </div>
      <Flash sp={sp} />

      <div className="filters">
        {week.map((d) => (
          <Link key={d} href={`/central/limpeza?data=${d}`} aria-current={d === date ? "true" : undefined}>
            {d === d0 ? "Hoje" : d === addDays(d0, 1) ? "Amanhã" : `${weekday(d)} ${fmtShort(d)}`}
            {byDate[d] ? ` · ${byDate[d]}` : ""}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="panel empty">Nenhuma limpeza para este dia.</div>
      ) : (
        <div className="cards">
          {rows.map((c) => (
            <article key={c.id} className={`card ${c.type === "saida_entrada" && c.status !== "vistoriada" ? "urgent" : ""}`}>
              <div className="card-top">
                <span className="card-title">{c.code}</span>
                <CleaningPill status={c.status} />
              </div>
              <div>
                <b>{CLEANING_TYPE[c.type]}</b>
                <div className="meta">
                  {c.type === "saida_entrada"
                    ? `Entra ${c.next_guest ?? "novo hóspede"} às 15h. Pronta até 14h30.`
                    : c.type === "saida"
                      ? "Saída às 11h, sem entrada hoje."
                      : c.notes ?? ""}
                </div>
                <div className="meta">
                  {c.assignee_name ? `Camareira: ${c.assignee_name}` : "Sem camareira definida"}
                  {c.checked_name ? ` · vistoria: ${c.checked_name}` : ""}
                </div>
              </div>

              <form action={setCleaningStatus}>
                <input type="hidden" name="id" value={c.id} />
                {c.status === "pendente" && <button className="btn btn-primary btn-small" name="status" value="em_andamento">Começar</button>}
                {c.status === "em_andamento" && <button className="btn btn-primary btn-small" name="status" value="pronta">Terminei</button>}
                {c.status === "pronta" && !isCam && <button className="btn btn-primary btn-small" name="status" value="vistoriada">Vistoriar e liberar</button>}
                {c.status === "pronta" && isCam && <span className="meta">Aguardando vistoria da governança.</span>}
                {c.status !== "pendente" && !isCam && <button className="btn btn-small" name="status" value="pendente">Voltar para pendente</button>}
              </form>

              {!isCam && (
                <form action={assignCleaning}>
                  <input type="hidden" name="id" value={c.id} />
                  <select name="assignee_id" defaultValue={c.assignee_id ?? ""} aria-label={`Camareira da ${c.code}`} style={{ flex: 1 }}>
                    <option value="">Sem camareira</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-small" type="submit">Definir</button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}

      {!isCam && (
        <details className="panel" style={{ marginTop: 20 }}>
          <summary className="panel-head" style={{ cursor: "pointer" }}><h2>Agendar limpeza avulsa</h2><span className="muted">profunda, meio de estadia</span></summary>
          <form action={createCleaning} className="form panel-body">
            <div className="grid-4">
              <div className="field">
                <label htmlFor="cl-unit">Unidade</label>
                <select id="cl-unit" name="unit_id" required defaultValue="">
                  <option value="" disabled>Escolha</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="cl-date">Data</label>
                <input id="cl-date" type="date" name="date" defaultValue={date} required />
              </div>
              <div className="field">
                <label htmlFor="cl-type">Tipo</label>
                <select id="cl-type" name="type" defaultValue="profunda">
                  <option value="profunda">Profunda</option>
                  <option value="meio_estadia">Meio de estadia</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="cl-who">Camareira</label>
                <select id="cl-who" name="assignee_id" defaultValue="">
                  <option value="">Definir depois</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="cl-notes">Observações</label>
              <input id="cl-notes" name="notes" placeholder="Ex.: troca de enxoval, estadia de 12 noites" />
            </div>
            <div><button className="btn btn-primary" type="submit">Agendar</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
