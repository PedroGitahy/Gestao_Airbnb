import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { suggestPrices } from "@/lib/pricing";
import { fmtShort, money, pct, weekday } from "@/lib/util";
import { Flash } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { deletePriceEvent, savePriceEvent } from "../../actions";

export default async function Precos({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser("precos");
  const sp = await searchParams;
  const [{ base, min, rows }, events] = await Promise.all([
    suggestPrices(60),
    db()`SELECT * FROM price_events WHERE date_to >= CURRENT_DATE ORDER BY date_from`,
  ]);
  const maxP = Math.max(...rows.map((r) => r.price), base);
  const changed = rows.filter((r) => r.price !== base);
  const text = ["Diária sugerida · studio padrão", ...changed.map((r) => `${weekday(r.date)} ${fmtShort(r.date)}: ${money(r.price)}`)].join("\n");

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Preços</h1>
          <p>
            Diária base {money(base)}{min ? `, mínimo ${money(min)}` : ""}. A sugestão sobe quando o prédio enche e cai quando uma data próxima está vazia. Ajuste base, mínimo e fim de semana em Configurações.
          </p>
        </div>
        <CopyButton text={text} label="Copiar datas com ajuste" />
      </div>
      <Flash sp={sp} />

      <div className="stack">
        <section className="panel" style={{ order: 2 }}>
          <div className="panel-head"><h2>Próximos 60 dias</h2><span className="muted">{changed.length} dias fora da base</span></div>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Data</th><th>Ocupação do prédio</th><th>Por quê</th><th className="num">Sugerida</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date}>
                    <td style={{ whiteSpace: "nowrap" }}><span className="muted">{weekday(r.date)}</span> {fmtShort(r.date)}</td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="meter" style={{ flex: 1, marginTop: 0 }}><i style={{ width: `${r.occupancy * 100}%` }} /></div>
                        <span className="num" style={{ fontSize: 13, minWidth: 64 }}>{r.booked}/{r.units} · {pct(r.occupancy)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {r.factors.length === 0 ? <span className="faint">base</span> : r.factors.map((f) => (
                        <span key={f.label} className={`pill ${f.value > 1 ? "good" : "warn"}`} style={{ marginRight: 4 }}>
                          {f.label} {f.value > 1 ? "+" : "−"}{Math.round(Math.abs(f.value - 1) * 100)}%
                        </span>
                      ))}
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, marginRight: 8, background: r.price > base ? "var(--good)" : r.price < base ? "var(--warn)" : "var(--line-strong)", opacity: Math.max(0.4, r.price / maxP) }} />
                      {money(r.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="two-col" style={{ order: 1 }}>
          <section className="panel">
            <div className="panel-head"><h2>Eventos e feriados</h2></div>
            <div className="list">
              {events.length === 0 && <div className="empty">Nenhum evento cadastrado.</div>}
              {events.map((e) => (
                <div key={e.id} className="list-item">
                  <div>
                    <div className="title">{e.name}</div>
                    <div className="meta">{fmtShort(e.date_from)} a {fmtShort(e.date_to)} · +{Math.round((Number(e.factor) - 1) * 100)}%</div>
                  </div>
                  <form action={deletePriceEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="btn-link" style={{ color: "var(--bad)" }} type="submit">Remover</button>
                  </form>
                </div>
              ))}
            </div>
            <form action={savePriceEvent} className="form panel-body" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="field"><label htmlFor="ev-name">Evento</label><input id="ev-name" name="name" placeholder="Ex.: show no Allianz Parque, feira no Expo Center Norte" required /></div>
              <div className="grid-3">
                <div className="field"><label htmlFor="ev-from">De</label><input id="ev-from" name="date_from" type="date" required /></div>
                <div className="field"><label htmlFor="ev-to">Até</label><input id="ev-to" name="date_to" type="date" /></div>
                <div className="field"><label htmlFor="ev-f">Aumento (%)</label><input id="ev-f" name="factor" inputMode="decimal" defaultValue="20" /></div>
              </div>
              <div><button className="btn btn-primary" type="submit">Incluir</button></div>
            </form>
          </section>
          <p className="faint" style={{ fontSize: 13, margin: 0 }}>
            A sugestão usa só os seus dados: ocupação do Artem, antecedência e eventos. Ferramentas pagas como o PriceLabs também comparam com concorrentes da região. Conforme o histórico cresce, a base pode ser recalibrada pela diária média real em Financeiro.
          </p>
        </div>
      </div>
    </div>
  );
}
