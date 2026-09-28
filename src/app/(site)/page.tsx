import { db } from "@/lib/db";
import { ensureDatabase } from "@/lib/schema";
import { getSettings } from "@/lib/util";
import { createLead } from "./actions";
import { AvailabilityDates } from "./AvailabilityDates";

export const dynamic = "force-dynamic";

const FIGURES = [
  { n: "9.000", u: "m²", t: "de lazer distribuídos em cinco pavimentos" },
  { n: "30", u: "+", t: "ambientes de uso comum" },
  { n: "3.000", u: "m²", t: "de bosque privativo com circuito de caminhada" },
  { n: "2", u: "", t: "piscinas, uma com borda infinita" },
  { n: "2", u: "", t: "rooftops nos andares mais altos" },
];

const NEAR = [
  { h: "Shopping Anália Franco", p: "Restaurantes, cinema, farmácia e supermercado.", d: "em frente" },
  { h: "Hospital e Maternidade Vitória", p: "Pronto atendimento e maternidade.", d: "a poucos passos" },
  { h: "Parque Ceret", p: "Pista de corrida, quadras e área verde.", d: "vizinho" },
  { h: "Hospital São Luiz", p: "Unidade Anália Franco.", d: "cerca de 5 min" },
  { h: "Metrô Tatuapé", p: "Linha 3-Vermelha e trens da CPTM.", d: "zona leste" },
  { h: "Universidade Cruzeiro do Sul", p: "Campus Anália Franco.", d: "no bairro" },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ enviado?: string; erro?: string }> }) {
  const sp = await searchParams;
  let s: Record<string, string> = {};
  let units = 20;
  try {
    await ensureDatabase();
    s = await getSettings();
    const [r] = await db()`SELECT count(*)::int AS n FROM units WHERE active`;
    units = r.n || 20;
  } catch {
    /* site continua no ar mesmo sem banco */
  }

  return (
    <main>
      <section className="wrap hero">
        <div>
          <span className="eyebrow-s">Jardim Anália Franco · São Paulo</span>
          <h1>Uma casa pronta, <em>em frente</em> ao Anália Franco.</h1>
          <p className="lede">
            {units} studios completos no Artem, o condomínio da Porte com bosque privativo, piscinas e rooftop.
            Para uma noite de trabalho, uma semana em família ou o tempo que um tratamento pedir.
          </p>
          <div className="cta">
            <a className="btn btn-primary" href="#reservar">Consultar datas</a>
            <a className="btn" href="#predio">Conhecer o prédio</a>
          </div>
        </div>
        <aside className="ficha" aria-label="Ficha da estadia">
          <h2>Ficha da estadia</h2>
          <dl>
            <div className="row"><dt>Endereço</dt><dd>R. Antônio Alves Barril, 177</dd></div>
            <div className="row"><dt>Check-in</dt><dd>a partir das {s.checkin_time || "15h"}, sem chaves</dd></div>
            <div className="row"><dt>Check-out</dt><dd>até as {s.checkout_time || "11h"}</dd></div>
            <div className="row"><dt>Studios</dt><dd>{units} unidades</dd></div>
            <div className="row"><dt>Atendimento</dt><dd>8h às 22h, resposta em 15 min</dd></div>
            <div className="row"><dt>Arquitetura</dt><dd>Anna Dietzsch</dd></div>
          </dl>
        </aside>
      </section>

      <section className="band" id="predio">
        <div className="wrap">
          <div className="band-head">
            <div>
              <span className="eyebrow-s">O prédio</span>
              <h2>Lazer de resort, rotina de casa.</h2>
            </div>
            <p>O Artem foi desenhado em torno de um bosque de mata atlântica. Cada studio tem ar-condicionado, cozinha equipada, enxoval de hotel trocado a cada hóspede e entrada por senha.</p>
          </div>
          <div className="figures">
            {FIGURES.map((f) => (
              <div className="figure" key={f.t}>
                <b>{f.n}<small>{f.u}</small></b>
                <span>{f.t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <div className="band-head">
            <div>
              <span className="eyebrow-s">Para quem</span>
              <h2>Três motivos que trazem gente ao bairro.</h2>
            </div>
            <p>Cada um pede uma estadia diferente. A operação da RGR foi pensada para os três.</p>
          </div>
          <div className="profiles">
            <article className="profile">
              <h3>Trabalho</h3>
              <p>Reuniões no Tatuapé e na zona leste, de segunda a sexta.</p>
              <ul><li>Mesa de trabalho e Wi-Fi dedicado</li><li>Chegada a qualquer hora, por senha</li><li>Recibo da estadia</li></ul>
            </article>
            <article className="profile">
              <h3>Saúde</h3>
              <p>Acompanhantes de pacientes do Vitória e do São Luiz.</p>
              <ul><li>Estadias longas com troca de enxoval</li><li>Cozinha completa</li><li>Datas flexíveis, falando direto com a gente</li></ul>
            </article>
            <article className="profile">
              <h3>Lazer</h3>
              <p>Compras, shows e jogos em São Paulo, com a família.</p>
              <ul><li>Piscinas, rooftop e bosque</li><li>Shopping do outro lado da rua</li><li>Metrô e trem por perto</li></ul>
            </article>
          </div>
        </div>
      </section>

      <section className="band" id="bairro">
        <div className="wrap">
          <div className="band-head">
            <div>
              <span className="eyebrow-s">O bairro</span>
              <h2>Tudo a uma travessia de rua.</h2>
            </div>
            <p>O Jardim Anália Franco reúne um dos maiores shoppings da zona leste, hospitais de referência e áreas verdes em poucas quadras.</p>
          </div>
          <div className="near">
            {NEAR.map((n) => (
              <div className="item" key={n.h}>
                <div><h3>{n.h}</h3><p>{n.p}</p></div>
                <span className="dist">{n.d}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="forest">
        <div className="wrap grid">
          <div className="year" aria-hidden="true">1698</div>
          <div>
            <span className="eyebrow-s">No quintal</span>
            <h2>Uma casa bandeirista ao lado de um prédio novo.</h2>
            <p>Vizinha ao Artem, a Casa do Regente Feijó foi registrada em 1698, com paredes de taipa de pilão. Abrigou o regente que lhe dá nome e, depois, um projeto da educadora Anália Franco.</p>
            <p>Hoje protege um trecho de mata atlântica nativa, o mesmo verde que chega ao bosque do condomínio.</p>
          </div>
        </div>
      </section>

      <section className="band" id="reservar">
        <div className="wrap book">
          <div>
            <span className="eyebrow-s">Reservar</span>
            <h2>Escolha como prefere reservar.</h2>
            <p className="muted" style={{ fontSize: 16.5, maxWidth: "32em" }}>
              Nas plataformas você vê a disponibilidade de cada studio na hora. Para estadias acima de 15 noites ou grupos, fale direto com a gente.
            </p>
            <div className="channels">
              {s.airbnb_url ? (
                <a className="channel" href={s.airbnb_url} target="_blank" rel="noreferrer"><b>Airbnb</b><span>ver studios e datas →</span></a>
              ) : (
                <div className="channel"><b>Airbnb</b><span>anúncios em breve</span></div>
              )}
              {s.booking_url ? (
                <a className="channel" href={s.booking_url} target="_blank" rel="noreferrer"><b>Booking.com</b><span>ver studios e datas →</span></a>
              ) : (
                <div className="channel"><b>Booking.com</b><span>anúncios em breve</span></div>
              )}
              {s.whatsapp_central && (
                <a className="channel" href={`https://wa.me/${s.whatsapp_central.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><b>WhatsApp</b><span>{s.whatsapp_central}</span></a>
              )}
            </div>
          </div>

          <form action={createLead} className="form">
            <div>
              <h3>Reserva direta ou estadia longa</h3>
              <p className="muted" style={{ margin: 0 }}>Respondemos em até 15 minutos, das 8h às 22h.</p>
            </div>
            {sp.enviado && <div className="flash ok" role="status">Recebemos seu pedido. Vamos responder pelo contato que você informou.</div>}
            {sp.erro === "dados" && <div className="flash err" role="alert">Informe seu nome e um e-mail ou WhatsApp para respondermos.</div>}
            {sp.erro === "limite" && <div className="flash err" role="alert">Recebemos vários pedidos deste endereço. Tente de novo em uma hora ou chame no WhatsApp.</div>}
            <div className="field"><label htmlFor="l-name">Nome</label><input id="l-name" name="name" required autoComplete="name" /></div>
            <div className="grid-2">
              <div className="field"><label htmlFor="l-phone">WhatsApp</label><input id="l-phone" name="phone" autoComplete="tel" inputMode="tel" /></div>
              <div className="field"><label htmlFor="l-email">E-mail</label><input id="l-email" name="email" type="email" autoComplete="email" /></div>
            </div>
            <AvailabilityDates />
            <div className="field">
              <label htmlFor="l-reason">Motivo da viagem</label>
              <select id="l-reason" name="reason" defaultValue="">
                <option value="">Prefiro não dizer</option>
                <option>Trabalho</option>
                <option>Saúde</option>
                <option>Lazer</option>
                <option>Mudança</option>
              </select>
            </div>
            <div className="field"><label htmlFor="l-msg">Mensagem</label><textarea id="l-msg" name="message" placeholder="Conte o que precisa" /></div>
            <div className="hp" aria-hidden="true"><label htmlFor="l-emp">Empresa</label><input id="l-emp" name="empresa" tabIndex={-1} autoComplete="off" /></div>
            <div><button className="btn btn-primary" type="submit">Enviar pedido</button></div>
          </form>
        </div>
      </section>
    </main>
  );
}
