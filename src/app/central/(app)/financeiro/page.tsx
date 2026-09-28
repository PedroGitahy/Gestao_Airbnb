import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { monthResults } from "@/lib/metrics";
import { addDays, EXPENSE_CATEGORIES, fmtShort, money, monthEnd, monthLabel, monthStart, pct, shiftMonth, today } from "@/lib/util";
import { Flash, UnitCode } from "@/components/ui";
import { createExpense, deleteExpense } from "../../actions";

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ mes?: string; ok?: string; erro?: string }> }) {
  await requireUser("financeiro");
  const sp = await searchParams;
  const base = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : monthStart(today());
  const mes = base.slice(0, 7);
  const sql = db();
  const [m, expenses, units, cats] = await Promise.all([
    monthResults(base),
    sql`SELECT e.*, u.code FROM expenses e LEFT JOIN units u ON u.id = e.unit_id
        WHERE e.date >= ${base}::date AND e.date < ${addDays(monthEnd(base), 1)}::date ORDER BY e.date DESC, e.id DESC`,
    sql`SELECT id, code FROM units WHERE active ORDER BY code`,
    sql`SELECT category, SUM(amount)::float AS total FROM expenses
        WHERE date >= ${base}::date AND date < ${addDays(monthEnd(base), 1)}::date GROUP BY category ORDER BY total DESC`,
  ]);
  const t = m.totals;
  const maxCat = Math.max(1, ...cats.map((c) => c.total));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Financeiro · {monthLabel(base)}</h1>
          <p>Receita rateada pelas noites dentro do mês. Custos “Geral” são divididos entre as unidades.</p>
        </div>
        <div className="actions">
          <Link className="btn" href={`/central/financeiro?mes=${shiftMonth(base, -1).slice(0, 7)}`} aria-label="Mês anterior">←</Link>
          <Link className="btn" href={`/central/financeiro?mes=${shiftMonth(base, 1).slice(0, 7)}`} aria-label="Próximo mês">→</Link>
          <a className="btn" href={`/central/financeiro/exportar?mes=${mes}`}>Exportar CSV</a>
        </div>
      </div>
      <Flash sp={sp} />

      <section className="kpis">
        <div className="kpi"><span className="k">Receita bruta</span><span className="v">{money(t.gross)}</span><span className="s">{t.nights} noites vendidas</span></div>
        <div className="kpi"><span className="k">Receita líquida</span><span className="v">{money(t.net)}</span><span className="s">após taxas e limpeza</span></div>
        <div className="kpi"><span className="k">Fixos + custos</span><span className="v">{money(t.fixed + t.variable)}</span><span className="s">fixos {money(t.fixed)}</span></div>
        <div className="kpi"><span className="k">Resultado</span><span className="v" style={{ color: t.result < 0 ? "var(--bad)" : "var(--good)" }}>{money(t.result)}</span><span className="s">margem {t.net ? pct(t.result / t.net) : "—"}</span></div>
        <div className="kpi"><span className="k">Ocupação</span><span className="v">{pct(t.occupancy)}</span><span className="s">diária média {money(t.adr)}</span></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Resultado por unidade</h2></div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th>Unidade</th><th className="num">Noites</th><th className="num">Ocupação</th><th className="num">Líquido</th>
                <th className="num">Fixos</th><th className="num">Custos</th><th className="num">Resultado</th><th className="num">Nota</th>
              </tr>
            </thead>
            <tbody>
              {m.units.map((u) => (
                <tr key={u.unit_id}>
                  <td><UnitCode code={u.code} /></td>
                  <td className="num">{u.nights}</td>
                  <td className="num">{pct(u.nights / m.days)}</td>
                  <td className="num">{money(u.net)}</td>
                  <td className="num">{money(u.fixed)}</td>
                  <td className="num">{money(u.variable)}</td>
                  <td className="num" style={{ color: u.result < 0 ? "var(--bad)" : undefined, fontWeight: 600 }}>{money(u.result)}</td>
                  <td className="num">{u.rating ? u.rating.toFixed(1).replace(".", ",") : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td><td className="num">{t.nights}</td><td className="num">{pct(t.occupancy)}</td><td className="num">{money(t.net)}</td>
                <td className="num">{money(t.fixed)}</td><td className="num">{money(t.variable)}</td><td className="num">{money(t.result)}</td><td className="num">{t.rating ? t.rating.toFixed(2).replace(".", ",") : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h2>Custos do mês</h2><span className="muted">{expenses.length} lançamentos</span></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Data</th><th>Unidade</th><th>Categoria</th><th>Descrição</th><th className="num">Valor</th><th></th></tr></thead>
              <tbody>
                {expenses.length === 0 && <tr><td colSpan={6} className="empty">Nenhum custo lançado neste mês.</td></tr>}
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{fmtShort(e.date)}</td>
                    <td>{e.code ? <UnitCode code={e.code} /> : <span className="muted">Geral</span>}</td>
                    <td>{e.category}</td>
                    <td>{e.description}{e.supplier ? <span className="faint"> · {e.supplier}</span> : null}</td>
                    <td className="num">{money(e.amount)}</td>
                    <td>
                      <form action={deleteExpense}>
                        <input type="hidden" name="id" value={e.id} />
                        <button className="btn-link" style={{ color: "var(--bad)" }} type="submit" aria-label={`Excluir lançamento de ${money(e.amount)}`}>Excluir</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Lançar custo</h2></div>
            <form action={createExpense} className="form panel-body">
              <input type="hidden" name="mes" value={mes} />
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="e-date">Data</label>
                  <input id="e-date" type="date" name="date" required defaultValue={mes === today().slice(0, 7) ? today() : base} />
                </div>
                <div className="field">
                  <label htmlFor="e-amount">Valor (R$)</label>
                  <input id="e-amount" name="amount" inputMode="decimal" required placeholder="0,00" />
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="e-unit">Unidade</label>
                  <select id="e-unit" name="unit_id" defaultValue="">
                    <option value="">Geral (rateado)</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="e-cat">Categoria</label>
                  <select id="e-cat" name="category" required defaultValue="">
                    <option value="" disabled>Escolha</option>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="e-desc">Descrição</label>
                <input id="e-desc" name="description" placeholder="Ex.: lavanderia semana 2" />
              </div>
              <div className="field">
                <label htmlFor="e-sup">Fornecedor</label>
                <input id="e-sup" name="supplier" />
              </div>
              <div><button className="btn btn-primary" type="submit">Lançar</button></div>
            </form>
          </section>

          {cats.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h2>Por categoria</h2></div>
              <div className="panel-body" style={{ display: "grid", gap: 10 }}>
                {cats.map((c) => (
                  <div key={c.category} style={{ display: "grid", gap: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span>{c.category}</span><span className="num">{money(c.total)}</span>
                    </div>
                    <div className="meter"><i style={{ width: `${(c.total / maxCat) * 100}%`, background: "var(--taipa)" }} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
