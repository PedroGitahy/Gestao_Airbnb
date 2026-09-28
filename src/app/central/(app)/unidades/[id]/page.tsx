import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/util";
import { Flash } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { saveUnit } from "../../../actions";

export default async function Unidade({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const user = await requireUser("unidades");
  const { id } = await params;
  const sp = await searchParams;
  const uid = Number(id);
  if (!Number.isInteger(uid)) notFound();
  const sql = db();
  const [[u], logs] = await Promise.all([
    sql`SELECT * FROM units WHERE id = ${uid}`,
    sql`SELECT * FROM sync_log WHERE unit_id = ${uid} ORDER BY ran_at DESC LIMIT 6`,
  ]);
  if (!u) notFound();
  const site = process.env.SITE_URL ?? "";
  const guide = `${site}/guia/${u.guide_token}`;
  const exportAirbnb = `${site}/api/ical/${u.ical_token}?para=airbnb`;
  const exportBooking = `${site}/api/ical/${u.ical_token}?para=booking`;
  const readOnly = user.role !== "admin";
  const dec = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Unidade {u.code}</h1>
          <p>{u.apt ? `Apartamento ${u.apt}` : "Número do apartamento ainda não cadastrado"}{u.floor ? ` · ${u.floor}º andar` : ""}</p>
        </div>
        <div className="actions">
          <a className="btn" href={guide} target="_blank" rel="noreferrer">Ver guia do hóspede</a>
          <Link className="btn" href="/central/unidades">Voltar</Link>
        </div>
      </div>
      <Flash sp={sp} />

      <div className="two-col">
        <form action={saveUnit} className="panel">
          <input type="hidden" name="id" value={u.id} />
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0 }}>
            <div className="panel-head"><h2>Cadastro</h2></div>
            <div className="panel-body form">
              <div className="grid-4">
                <div className="field"><label htmlFor="apt">Apto</label><input id="apt" name="apt" defaultValue={u.apt ?? ""} /></div>
                <div className="field"><label htmlFor="floor">Andar</label><input id="floor" name="floor" defaultValue={u.floor ?? ""} /></div>
                <div className="field"><label htmlFor="area">Área (m²)</label><input id="area" name="area" inputMode="decimal" defaultValue={dec(u.area)} /></div>
                <div className="field"><label htmlFor="capacity">Pessoas</label><input id="capacity" name="capacity" inputMode="numeric" defaultValue={u.capacity} /></div>
              </div>
              <div className="grid-3">
                <div className="field"><label htmlFor="wifi_network">Rede Wi-Fi</label><input id="wifi_network" name="wifi_network" defaultValue={u.wifi_network ?? ""} /></div>
                <div className="field"><label htmlFor="wifi_password">Senha Wi-Fi</label><input id="wifi_password" name="wifi_password" defaultValue={u.wifi_password ?? ""} /></div>
                <div className="field"><label htmlFor="lock_id">Fechadura (ID)</label><input id="lock_id" name="lock_id" defaultValue={u.lock_id ?? ""} /></div>
              </div>

              <div className="field">
                <label htmlFor="ical_airbnb">Link iCal do Airbnb</label>
                <input id="ical_airbnb" name="ical_airbnb" defaultValue={u.ical_airbnb ?? ""} placeholder="https://www.airbnb.com.br/calendar/ical/…" />
                <small>No Airbnb: Calendário › Disponibilidade › Conectar a outro site › Exportar calendário.</small>
              </div>
              <div className="field">
                <label htmlFor="ical_booking">Link iCal do Booking</label>
                <input id="ical_booking" name="ical_booking" defaultValue={u.ical_booking ?? ""} placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?t=…" />
                <small>No Booking: Tarifas e disponibilidade › Sincronizar calendários › Exportar.</small>
              </div>

              <div className="grid-3">
                <div className="field"><label htmlFor="condo_fee">Condomínio / mês</label><input id="condo_fee" name="condo_fee" inputMode="decimal" defaultValue={dec(u.condo_fee)} /></div>
                <div className="field"><label htmlFor="iptu">IPTU / mês</label><input id="iptu" name="iptu" inputMode="decimal" defaultValue={dec(u.iptu)} /></div>
                <div className="field"><label htmlFor="internet">Internet / mês</label><input id="internet" name="internet" inputMode="decimal" defaultValue={dec(u.internet)} /></div>
              </div>
              <div className="field"><label htmlFor="notes">Observações</label><textarea id="notes" name="notes" defaultValue={u.notes ?? ""} /></div>
              <label className="check"><input type="checkbox" name="active" defaultChecked={u.active} /> Unidade em operação</label>
              {!readOnly && <div><button className="btn btn-primary" type="submit">Salvar unidade</button></div>}
            </div>
          </fieldset>
        </form>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Links desta unidade</h2></div>
            <div className="panel-body stack" style={{ gap: 16 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="label">Guia do hóspede</span><CopyButton text={guide} /></div>
                <div className="copybox">{guide}</div>
                <small className="faint">Mostra o Wi-Fi desta unidade. Envie só ao hóspede.</small>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="label">Importar no Airbnb</span><CopyButton text={exportAirbnb} /></div>
                <div className="copybox">{exportAirbnb}</div>
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span className="label">Importar no Booking</span><CopyButton text={exportBooking} /></div>
                <div className="copybox">{exportBooking}</div>
                <small className="faint">Cole esses links em “Importar calendário” de cada plataforma. Assim uma reserva direta ou do outro canal bloqueia as datas automaticamente.</small>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Sincronizações recentes</h2></div>
            {logs.length === 0 ? (
              <div className="empty">Ainda não houve sincronização.</div>
            ) : (
              <div className="list">
                {logs.map((l) => (
                  <div key={l.id} className="list-item">
                    <div>
                      <div className="title">{l.channel === "airbnb" ? "Airbnb" : "Booking"}</div>
                      <div className="meta">{fmtDateTime(l.ran_at)}{l.message ? ` · ${l.message}` : ` · ${l.events} eventos`}</div>
                    </div>
                    <span className={`pill ${l.ok ? "good" : "bad"}`}>{l.ok ? "ok" : "erro"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
