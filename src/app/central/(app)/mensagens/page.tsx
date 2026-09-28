import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evolutionReady, PLACEHOLDERS, renderMessage, TRIGGERS, waLink } from "@/lib/messages";
import { fmtDateTime, getSettings } from "@/lib/util";
import { Flash, UnitCode } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { runMessagesNow, saveTemplate, setMessageStatus } from "../../actions";

const VIEWS = [
  { key: "fila", label: "Para enviar" },
  { key: "agenda", label: "Próximos 7 dias" },
  { key: "enviadas", label: "Histórico" },
  { key: "modelos", label: "Modelos" },
];

const TONE: Record<string, string> = { agendada: "info", enviada: "good", manual: "warn", falhou: "bad", ignorada: "" };
const LABEL: Record<string, string> = { agendada: "Agendada", enviada: "Enviada", manual: "Enviar à mão", falhou: "Falhou", ignorada: "Ignorada" };

export default async function Mensagens({ searchParams }: { searchParams: Promise<{ v?: string; ok?: string; erro?: string }> }) {
  const user = await requireUser("mensagens");
  const sp = await searchParams;
  const view = VIEWS.some((v) => v.key === sp.v) ? sp.v! : "fila";
  const sql = db();
  const s = await getSettings();
  const auto = s.auto_messages === "on" && evolutionReady();

  const where =
    view === "fila"
      ? sql`m.status IN ('manual','falhou')`
      : view === "agenda"
        ? sql`m.status = 'agendada' AND m.scheduled_for < now() + interval '7 days'`
        : sql`m.status IN ('enviada','ignorada') AND m.scheduled_for > now() - interval '30 days'`;
  const order = view === "enviadas" ? sql`m.scheduled_for DESC` : sql`m.scheduled_for`;

  const [rows, templates] = await Promise.all([
    view === "modelos"
      ? Promise.resolve([])
      : sql`
        SELECT m.id, m.status, m.scheduled_for, m.body AS sent_body, m.note, m.sent_at, t.name AS tname, t.body AS tbody,
          r.id AS rid, r.guest_name, r.guest_phone, r.check_in, r.check_out, r.door_code,
          u.code, u.apt, u.floor, u.wifi_network, u.wifi_password, u.guide_token
        FROM message_log m
        JOIN message_templates t ON t.id = m.template_id
        JOIN reservations r ON r.id = m.reservation_id
        JOIN units u ON u.id = r.unit_id
        WHERE ${where} ORDER BY ${order} LIMIT 200`,
    sql`SELECT * FROM message_templates ORDER BY sort, id`,
  ]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Mensagens</h1>
          <p>
            {auto
              ? "Envio automático ligado: as mensagens saem pelo WhatsApp da central na hora marcada."
              : "Envio automático desligado: a central prepara cada mensagem e você envia com um toque."}
          </p>
        </div>
        <form action={runMessagesNow}><button className="btn" type="submit">Processar agora</button></form>
      </div>
      <Flash sp={sp} />
      <div className="filters">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/central/mensagens?v=${v.key}`} aria-current={v.key === view ? "true" : undefined}>{v.label}</Link>
        ))}
      </div>

      {view !== "modelos" && (
        <div className="panel">
          {rows.length === 0 ? (
            <div className="empty">
              {view === "fila" ? "Nada para enviar à mão agora." : view === "agenda" ? "Nenhuma mensagem agendada para os próximos 7 dias." : "Nenhuma mensagem nos últimos 30 dias."}
            </div>
          ) : (
            <div className="list">
              {rows.map((m) => {
                const text = m.sent_body ?? renderMessage(m.tbody, m, s).text;
                const link = waLink(m.guest_phone, text);
                return (
                  <div key={m.id} className="list-item" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 360px", minWidth: 0, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <UnitCode code={m.code} />
                        <Link className="row-link" href={`/central/reservas/${m.rid}`}>{m.guest_name ?? "Hóspede sem nome"}</Link>
                        <span className="muted" style={{ fontSize: 13 }}>{m.tname} · {fmtDateTime(m.status === "enviada" ? m.sent_at : m.scheduled_for)}</span>
                      </div>
                      {m.note && <div className="meta" style={{ color: m.status === "falhou" ? "var(--bad)" : "var(--warn)" }}>{m.note}</div>}
                      {view !== "enviadas" && <div className="copybox" style={{ fontSize: 12.5 }}>{text}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      <span className={`pill ${TONE[m.status]}`}>{LABEL[m.status]}</span>
                      {view === "fila" && (
                        <>
                          {link ? (
                            <a className="btn btn-primary btn-small" href={link} target="_blank" rel="noreferrer">Abrir no WhatsApp</a>
                          ) : (
                            <Link className="btn btn-small" href={`/central/reservas/${m.rid}`}>Completar reserva</Link>
                          )}
                          <CopyButton text={text} label="Copiar texto" />
                          <form action={setMessageStatus} style={{ display: "flex", gap: 6 }}>
                            <input type="hidden" name="id" value={m.id} />
                            <button className="btn btn-small" name="status" value="enviada">Marcar enviada</button>
                            <button className="btn btn-small" name="status" value="reenviar" title="Tentar de novo depois de completar os dados">Tentar de novo</button>
                            <button className="btn-link" name="status" value="ignorada" style={{ color: "var(--muted)" }}>Ignorar</button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "modelos" && (
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Campos que a central preenche sozinha: {PLACEHOLDERS.map((p) => <code key={p} className="mono" style={{ marginRight: 6 }}>{`{${p}}`}</code>)}. Se faltar algum dado, a mensagem vai para a fila de envio manual em vez de sair incompleta.
          </p>
          {[...templates, null].map((t) => (
            <form key={t?.id ?? "novo"} action={saveTemplate} className="panel">
              {t && <input type="hidden" name="id" value={t.id} />}
              <fieldset disabled={user.role !== "admin"} style={{ border: 0, margin: 0, padding: 0 }}>
                <div className="panel-head">
                  <h2>{t ? t.name : "Nova mensagem"}</h2>
                  {t && <label className="check"><input type="checkbox" name="active" defaultChecked={t.active} /> ativa</label>}
                  {!t && <input type="hidden" name="active" value="on" />}
                </div>
                <div className="panel-body form">
                  <div className="grid-4">
                    <div className="field"><label htmlFor={`n-${t?.id ?? 0}`}>Nome</label><input id={`n-${t?.id ?? 0}`} name="name" defaultValue={t?.name ?? ""} required /></div>
                    <div className="field">
                      <label htmlFor={`g-${t?.id ?? 0}`}>Quando</label>
                      <select id={`g-${t?.id ?? 0}`} name="trigger" defaultValue={t?.trigger ?? "antes_entrada"}>
                        {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div className="field"><label htmlFor={`d-${t?.id ?? 0}`}>Dias</label><input id={`d-${t?.id ?? 0}`} name="offset_days" inputMode="numeric" defaultValue={t?.offset_days ?? 1} /></div>
                    <div className="field"><label htmlFor={`h-${t?.id ?? 0}`}>Horário</label><input id={`h-${t?.id ?? 0}`} name="send_time" type="time" defaultValue={t?.send_time ?? "10:00"} /></div>
                  </div>
                  <div className="field">
                    <label htmlFor={`b-${t?.id ?? 0}`}>Texto</label>
                    <textarea id={`b-${t?.id ?? 0}`} name="body" defaultValue={t?.body ?? ""} style={{ minHeight: 150, fontFamily: "var(--mono)", fontSize: 13 }} required />
                  </div>
                  {user.role === "admin" && <div><button className="btn btn-primary" type="submit">{t ? "Salvar modelo" : "Criar mensagem"}</button></div>}
                </div>
              </fieldset>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
