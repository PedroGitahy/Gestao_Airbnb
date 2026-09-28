import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiReady } from "@/lib/ai";
import { addDays, fmtShort, today } from "@/lib/util";
import { Flash, UnitCode } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { createReview, draftReviewResponse, saveReviewResponse } from "../../actions";

export default async function Avaliacoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser("avaliacoes");
  const sp = await searchParams;
  const sql = db();
  const [reviews, stats, recent, units] = await Promise.all([
    sql`SELECT rv.*, u.code FROM reviews rv LEFT JOIN units u ON u.id = rv.unit_id ORDER BY rv.responded, rv.review_date DESC, rv.id DESC LIMIT 100`,
    sql`SELECT count(*)::int AS n, avg(rating)::float AS avg,
          count(*) FILTER (WHERE rating >= 4.8)::int AS top, count(*) FILTER (WHERE rating < 4)::int AS low
        FROM reviews WHERE review_date > CURRENT_DATE - 180`,
    sql`SELECT r.id, r.guest_name, r.check_out, u.code FROM reservations r JOIN units u ON u.id = r.unit_id
        WHERE r.kind = 'reserva' AND r.status = 'confirmada' AND r.check_out <= ${today()}::date AND r.check_out > ${addDays(today(), -30)}::date
          AND NOT EXISTS (SELECT 1 FROM reviews v WHERE v.reservation_id = r.id)
        ORDER BY r.check_out DESC`,
    sql`SELECT id, code FROM units WHERE active ORDER BY code`,
  ]);
  const st = stats[0];
  const ai = aiReady();

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Avaliações</h1>
          <p>Registre cada avaliação recebida. A IA sugere a resposta e você revisa antes de publicar na plataforma.</p>
        </div>
      </div>
      <Flash sp={sp} />

      <section className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi"><span className="k">Nota média · 6 meses</span><span className="v">{st.avg ? st.avg.toFixed(2).replace(".", ",") : "—"}</span><span className="s">{st.n} avaliações</span></div>
        <div className="kpi"><span className="k">4,8 ou mais</span><span className="v">{st.n ? Math.round((st.top / st.n) * 100) : 0}%</span><span className="s">faixa de Superhost</span></div>
        <div className="kpi"><span className="k">Abaixo de 4</span><span className="v" style={{ color: st.low ? "var(--bad)" : undefined }}>{st.low}</span><span className="s">pedem ação</span></div>
        <div className="kpi"><span className="k">Sem resposta</span><span className="v">{reviews.filter((r) => !r.responded).length}</span><span className="s">responda em até 48h</span></div>
      </section>

      <div className="two-col">
        <div className="stack">
          {reviews.length === 0 && <div className="panel empty">Nenhuma avaliação registrada ainda.</div>}
          {reviews.map((r) => (
            <article key={r.id} id={`r${r.id}`} className="panel">
              <div className="panel-head">
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {r.code && <UnitCode code={r.code} />}
                  <b>{r.guest_name ?? "Hóspede"}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{r.channel === "booking" ? "Booking" : "Airbnb"} · {fmtShort(r.review_date)}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {r.rating != null && <span className={`pill ${Number(r.rating) >= 4.8 ? "good" : Number(r.rating) >= 4 ? "warn" : "bad"}`}>{String(r.rating).replace(".", ",")}</span>}
                  {r.responded ? <span className="pill moss">Respondida</span> : <span className="pill warn">Sem resposta</span>}
                </div>
              </div>
              <div className="panel-body stack" style={{ gap: 12 }}>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "var(--serif)", fontSize: 17, lineHeight: 1.5 }}>{r.text}</p>
                <form action={saveReviewResponse} className="form">
                  <input type="hidden" name="id" value={r.id} />
                  <div className="field">
                    <label htmlFor={`resp-${r.id}`}>Resposta pública</label>
                    <textarea id={`resp-${r.id}`} name="response" defaultValue={r.response ?? ""} placeholder={ai ? "Use o botão abaixo para a IA sugerir uma resposta" : "Escreva a resposta"} />
                  </div>
                  <div className="actions">
                    <label className="check"><input type="checkbox" name="responded" defaultChecked={r.responded} /> publicada na plataforma</label>
                    <button className="btn btn-primary btn-small" type="submit">Salvar</button>
                    {r.response && <CopyButton text={r.response} label="Copiar resposta" />}
                  </div>
                </form>
                {ai && (
                  <form action={draftReviewResponse}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-small" type="submit">{r.response ? "Sugerir outra resposta com IA" : "Sugerir resposta com IA"}</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Registrar avaliação</h2></div>
            <form action={createReview} className="form panel-body">
              <div className="field">
                <label htmlFor="rv-res">Estadia</label>
                <select id="rv-res" name="reservation_id" defaultValue="">
                  <option value="">Outra ou não sei</option>
                  {recent.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.guest_name ?? "sem nome"} · saiu {fmtShort(x.check_out)}</option>)}
                </select>
                <small>Saídas dos últimos 30 dias ainda sem avaliação.</small>
              </div>
              <div className="grid-3">
                <div className="field"><label htmlFor="rv-rating">Nota</label><input id="rv-rating" name="rating" inputMode="decimal" placeholder="5" /></div>
                <div className="field">
                  <label htmlFor="rv-ch">Canal</label>
                  <select id="rv-ch" name="channel" defaultValue="airbnb"><option value="airbnb">Airbnb</option><option value="booking">Booking</option><option value="direto">Direto</option></select>
                </div>
                <div className="field">
                  <label htmlFor="rv-unit">Unidade</label>
                  <select id="rv-unit" name="unit_id" defaultValue=""><option value="">da estadia</option>{units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}</select>
                </div>
              </div>
              <div className="field"><label htmlFor="rv-name">Hóspede</label><input id="rv-name" name="guest_name" placeholder="se não escolheu a estadia" /></div>
              <div className="field"><label htmlFor="rv-text">Texto da avaliação</label><textarea id="rv-text" name="text" required style={{ minHeight: 120 }} /></div>
              <div><button className="btn btn-primary" type="submit">Registrar</button></div>
            </form>
          </section>
          {!ai && <p className="faint" style={{ fontSize: 13, margin: 0 }}>Para a IA sugerir respostas, configure AI_API_KEY no servidor. Serve a mesma chave do Groq que o agente de WhatsApp já usa.</p>}
        </div>
      </div>
    </div>
  );
}
