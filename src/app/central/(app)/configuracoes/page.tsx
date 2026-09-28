import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/util";
import { Flash } from "@/components/ui";
import { saveSettings } from "../../actions";

const pctIn = (v?: string) => (v ? String(Math.round(Number(v) * 1000) / 10).replace(".", ",") : "");

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser("configuracoes");
  const sp = await searchParams;
  const s = await getSettings();

  return (
    <div style={{ maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p>Contatos e links aparecem no site e no guia do hóspede. Taxas e metas alimentam o painel.</p>
        </div>
      </div>
      <Flash sp={sp} />
      <form action={saveSettings} className="stack">
        <section className="panel">
          <div className="panel-head"><h2>Contatos</h2></div>
          <div className="panel-body form">
            <div className="grid-2">
              <div className="field"><label htmlFor="whatsapp_central">WhatsApp da central</label><input id="whatsapp_central" name="whatsapp_central" defaultValue={s.whatsapp_central} placeholder="+55 11 9…" /></div>
              <div className="field"><label htmlFor="email_contato">E-mail de contato</label><input id="email_contato" name="email_contato" type="email" defaultValue={s.email_contato} /></div>
              <div className="field"><label htmlFor="phone_portaria">Telefone da portaria</label><input id="phone_portaria" name="phone_portaria" defaultValue={s.phone_portaria} /></div>
              <div className="field"><label htmlFor="phone_plantao">Plantão noturno</label><input id="phone_plantao" name="phone_plantao" defaultValue={s.phone_plantao} /></div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Anúncios</h2></div>
          <div className="panel-body form">
            <div className="field"><label htmlFor="airbnb_url">Página no Airbnb</label><input id="airbnb_url" name="airbnb_url" defaultValue={s.airbnb_url} placeholder="https://www.airbnb.com.br/users/show/…" /><small>Perfil de anfitrião ou anúncio principal. Aparece no botão “Reservar no Airbnb” do site.</small></div>
            <div className="field"><label htmlFor="booking_url">Página no Booking</label><input id="booking_url" name="booking_url" defaultValue={s.booking_url} /></div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Operação</h2></div>
          <div className="panel-body form">
            <div className="grid-4">
              <div className="field"><label htmlFor="checkin_time">Check-in</label><input id="checkin_time" name="checkin_time" defaultValue={s.checkin_time} /></div>
              <div className="field"><label htmlFor="checkout_time">Check-out</label><input id="checkout_time" name="checkout_time" defaultValue={s.checkout_time} /></div>
              <div className="field"><label htmlFor="airbnb_fee">Taxa Airbnb (%)</label><input id="airbnb_fee" name="airbnb_fee" inputMode="decimal" defaultValue={pctIn(s.airbnb_fee)} /></div>
              <div className="field"><label htmlFor="booking_fee">Taxa Booking (%)</label><input id="booking_fee" name="booking_fee" inputMode="decimal" defaultValue={pctIn(s.booking_fee)} /></div>
            </div>
            <div className="grid-3">
              <div className="field"><label htmlFor="occupancy_goal">Meta de ocupação (%)</label><input id="occupancy_goal" name="occupancy_goal" inputMode="decimal" defaultValue={pctIn(s.occupancy_goal)} /></div>
              <div className="field"><label htmlFor="rating_goal">Meta de nota</label><input id="rating_goal" name="rating_goal" inputMode="decimal" defaultValue={s.rating_goal?.replace(".", ",")} /></div>
              <div className="field"><label htmlFor="trash_location">Onde descartar o lixo</label><input id="trash_location" name="trash_location" defaultValue={s.trash_location} placeholder="Ex.: lixeira no hall de cada andar" /></div>
            </div>
            <input type="hidden" name="company_name" value={s.company_name} />
          </div>
        </section>
        <div><button className="btn btn-primary" type="submit">Salvar configurações</button></div>
      </form>
    </div>
  );
}
