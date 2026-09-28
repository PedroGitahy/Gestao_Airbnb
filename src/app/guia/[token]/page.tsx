import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ensureDatabase } from "@/lib/schema";
import { getSettings } from "@/lib/util";
import { GuideShell } from "./GuideShell";
import "../guia.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Guia do hóspede", robots: { index: false, follow: false } };

const Fill = ({ children }: { children: React.ReactNode }) => <i className="fill">{children}</i>;
const T = ({ pt, en }: { pt: React.ReactNode; en: React.ReactNode }) => (
  <>
    <span lang="pt">{pt}</span>
    <span lang="en">{en}</span>
  </>
);

export default async function Guia({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await ensureDatabase();
  const [u] = await db()`SELECT code, apt, floor, capacity, wifi_network, wifi_password FROM units WHERE guide_token = ${token} AND active`;
  if (!u) notFound();
  const s = await getSettings();
  const cin = s.checkin_time || "15h";
  const cout = s.checkout_time || "11h";
  const cinEn = cin.replace(/^(\d+)h$/, (_: string, h: string) => `${Number(h) > 12 ? Number(h) - 12 : h} ${Number(h) >= 12 ? "pm" : "am"}`);
  const coutEn = cout.replace(/^(\d+)h$/, (_: string, h: string) => `${Number(h) > 12 ? Number(h) - 12 : h} ${Number(h) >= 12 ? "pm" : "am"}`);

  return (
    <GuideShell wifiPassword={u.wifi_password}>
      <main className="wrap">
        <header className="hero">
          <div className="eyebrow"><T pt={`Guia do hóspede · apartamento ${u.apt ?? u.code}`} en={`Guest guide · apartment ${u.apt ?? u.code}`} /></div>
          <h1><T pt={<>Bem-vindo ao <em>Artem</em>.</>} en={<>Welcome to <em>Artem</em>.</>} /></h1>
          <p className="lede"><T pt="Tudo o que você precisa para a estadia está nesta página: como entrar, como usar o apartamento e o que há de bom por perto." en="Everything you need for your stay is on this page: getting in, using the apartment, and what's worth seeing nearby." /></p>
          <p className="addr"><strong>Rua Antônio Alves Barril, 177</strong> · Jardim Anália Franco · São Paulo</p>
        </header>

        <div className="essentials">
          <div className="ess"><span className="k">Check-in</span><span className="v">{cin}</span><span className="s"><T pt="entrada por senha" en="keyless, by code" /></span></div>
          <div className="ess"><span className="k">Check-out</span><span className="v">{cout}</span><span className="s"><T pt="sem entrega de chaves" en="no keys to return" /></span></div>
          <div className="ess wifi">
            <span className="k">Wi-Fi</span>
            <span className="v">{u.wifi_network ?? <Fill>[rede]</Fill>}<br />{u.wifi_password ?? <Fill>[senha]</Fill>}</span>
            {u.wifi_password && <button className="copy" type="button" data-copy-wifi><T pt="Copiar senha" en="Copy password" /></button>}
          </div>
        </div>

        <section id="chegada">
          <h2><T pt="Chegada" en="Arrival" /></h2>
          <p className="sub"><T pt={`A senha da porta chega por mensagem na véspera e funciona a partir das ${cin} do dia de entrada.`} en={`Your door code arrives by message the day before and works from ${cinEn} on arrival day.`} /></p>
          <ol className="steps">
            <li><div><b><T pt="Portaria" en="Front desk" /></b><T pt={`Informe seu nome e o apartamento ${u.apt ?? ""}. Seu cadastro já estará feito.`} en={`Give your name and apartment ${u.apt ?? ""}. You'll already be registered.`} /></div></li>
            <li><div><b><T pt="Elevador" en="Elevator" /></b><T pt={u.floor ? `Suba até o ${u.floor}º andar.` : "Suba até o andar indicado na mensagem de chegada."} en={u.floor ? `Go up to floor ${u.floor}.` : "Go up to the floor in your arrival message."} /></div></li>
            <li><div><b><T pt="Fechadura" en="Door lock" /></b><T pt="Toque no painel para acender, digite a senha e confirme. Para trancar por dentro, gire o botão interno." en="Touch the keypad to wake it, enter your code and confirm. To lock from inside, turn the inner knob." /></div></li>
            <li><div><b><T pt="Conte pra gente" en="Let us know" /></b><T pt="Uma mensagem curta avisando que entrou bem ajuda a equipe a acompanhar sua chegada." en="A short message once you're in helps us know you arrived safely." /></div></li>
          </ol>
        </section>

        <section id="apartamento">
          <h2><T pt="O apartamento" en="The apartment" /></h2>
          <p className="sub"><T pt="Studio completo, preparado para uma noite ou algumas semanas." en="A fully equipped studio, ready for one night or a few weeks." /></p>
          <div className="how">
            <div><h3><T pt="Ar-condicionado" en="Air conditioning" /></h3><p><T pt="O controle fica na mesa de cabeceira. Recomendamos 23 °C e janelas fechadas com o aparelho ligado." en="The remote is on the bedside table. We recommend 23 °C with windows closed while it runs." /></p></div>
            <div><h3>TV</h3><p><T pt="Aplicativos de streaming já instalados. Entre com a sua conta e saia antes do check-out." en="Streaming apps are installed. Sign in with your own account and sign out before you leave." /></p></div>
            <div><h3><T pt="Cozinha" en="Kitchen" /></h3><p><T pt="Micro-ondas, geladeira, louça e utensílios para duas pessoas." en="Microwave, fridge, dishes and utensils for two." /></p></div>
            <div><h3><T pt="Enxoval" en="Linens" /></h3><p><T pt="Toalhas e roupa de cama trocadas a cada 4 noites em estadias longas. Precisa de mais? É só pedir." en="Towels and bed linen changed every 4 nights on longer stays. Need extra? Just ask." /></p></div>
            <div><h3><T pt="Lixo" en="Trash" /></h3><p><T pt={<>Descarte em {s.trash_location || <Fill>[local da lixeira]</Fill>}. Recicláveis separados, por favor.</>} en={<>Please use {s.trash_location || <Fill>[trash room]</Fill>}. Separate recyclables, please.</>} /></p></div>
            <div><h3><T pt="Lazer do Artem" en="Artem amenities" /></h3><p><T pt="Piscinas, rooftop, academia e bosque privativo, conforme horários e regras do condomínio." en="Pools, rooftop, gym and a private woodland, subject to the building's hours and rules." /></p></div>
          </div>
        </section>

        <section id="regras">
          <h2><T pt="Regras da casa" en="House rules" /></h2>
          <p className="sub"><T pt="O Artem é um condomínio residencial. Estas regras protegem você e os vizinhos." en="Artem is a residential building. These rules protect you and your neighbors." /></p>
          <ul className="rules">
            <li><span><T pt="Silêncio" en="Quiet hours" /></span><span>22h – 8h</span></li>
            <li><span><T pt="Hóspedes" en="Guests" /></span><span><T pt={`até ${u.capacity} pessoas`} en={`up to ${u.capacity} people`} /></span></li>
            <li><span><T pt="Visitas" en="Visitors" /></span><span><T pt="com cadastro prévio na portaria" en="registered in advance" /></span></li>
            <li><span><T pt="Festas e eventos" en="Parties and events" /></span><span><T pt="não permitidos" en="not allowed" /></span></li>
            <li><span><T pt="Fumar" en="Smoking" /></span><span><T pt="proibido, inclusive na varanda" en="not allowed, balcony included" /></span></li>
          </ul>
        </section>

        <section id="bairro">
          <h2><T pt="O bairro" en="The neighborhood" /></h2>
          <p className="sub"><T pt="O Anália Franco reúne compras, verde e serviços em poucas quadras." en="Anália Franco puts shopping, green space and services within a few blocks." /></p>
          <div className="places">
            <div className="place"><div><h3>Shopping Anália Franco</h3><p><T pt="Do outro lado da rua. Restaurantes, cinema, farmácia e supermercado." en="Across the street. Restaurants, cinema, pharmacy and a supermarket." /></p></div><span className="tag"><T pt="Em frente" en="Across" /></span></div>
            <div className="place"><div><h3>Parque Ceret</h3><p><T pt="Pista de caminhada, quadras e áreas verdes." en="Walking track, courts and green space." /></p></div><span className="tag"><T pt="Parque" en="Park" /></span></div>
            <div className="place"><div><h3>Hospital e Maternidade Vitória</h3><p><T pt="A poucos passos. O Hospital São Luiz fica a cerca de 5 minutos." en="A short walk away. São Luiz Hospital is about 5 minutes away." /></p></div><span className="tag"><T pt="Saúde" en="Health" /></span></div>
            <div className="place"><div><h3><T pt="Metrô Tatuapé" en="Tatuapé subway" /></h3><p><T pt="Linha 3-Vermelha e trens da CPTM." en="Red Line 3 and CPTM trains." /></p></div><span className="tag"><T pt="Transporte" en="Transit" /></span></div>
          </div>
          <div className="story">
            <span className="eyebrow"><T pt="No quintal, 1698" en="Next door, since 1698" /></span>
            <p><T pt="Vizinha ao Artem, a Casa do Regente Feijó é uma construção bandeirista de taipa de pilão registrada em 1698, cercada por mata atlântica preservada." en="Next to Artem, the Casa do Regente Feijó is a colonial rammed-earth house recorded in 1698, set in preserved Atlantic Forest." /></p>
          </div>
        </section>

        <section id="saida">
          <h2><T pt="Saída" en="Check-out" /></h2>
          <p className="sub"><T pt={`Até as ${cout}. Três pedidos simples e pronto.`} en={`By ${coutEn}. Three small things and you're done.`} /></p>
          <ol className="steps">
            <li><div><b><T pt="Desligue o ar-condicionado" en="Turn off the air conditioning" /></b><T pt="E as luzes, se possível." en="And the lights, if you can." /></div></li>
            <li><div><b><T pt="Lixo no cesto da cozinha" en="Trash in the kitchen bin" /></b><T pt="Toalhas e roupa de cama podem ficar onde estão." en="Towels and bed linen can stay where they are." /></div></li>
            <li><div><b><T pt="Feche bem a porta" en="Close the door firmly" /></b><T pt={`A fechadura tranca sozinha. Sua senha expira às ${cout}.`} en={`It locks automatically. Your code expires at ${coutEn}.`} /></div></li>
          </ol>
        </section>

        <section id="contato">
          <h2><T pt="Contato" en="Contact" /></h2>
          <p className="sub"><T pt="Respondemos em até 15 minutos, das 8h às 22h. Fora desse horário, somente urgências." en="We reply within 15 minutes, 8 am to 10 pm. Outside those hours, emergencies only." /></p>
          <div className="contacts">
            <div className="contact main"><span className="k"><T pt="Central RGR" en="RGR team" /></span><div className="n">{s.whatsapp_central || <Fill>[WhatsApp]</Fill>}</div><p><T pt="Qualquer dúvida ou imprevisto" en="Questions or anything unexpected" /></p></div>
            <div className="contact"><span className="k"><T pt="Portaria Artem" en="Front desk" /></span><div className="n">{s.phone_portaria || <Fill>[telefone]</Fill>}</div><p><T pt="Encomendas e visitantes" en="Deliveries and visitors" /></p></div>
            <div className="contact"><span className="k"><T pt="Plantão noturno" en="Night emergencies" /></span><div className="n">{s.phone_plantao || <Fill>[telefone]</Fill>}</div><p><T pt="Vazamento, sem luz, sem acesso" en="Leaks, power loss, locked out" /></p></div>
          </div>
          <div className="sos"><span>SAMU <b>192</b></span><span><T pt="Bombeiros" en="Fire" /> <b>193</b></span><span><T pt="Polícia" en="Police" /> <b>190</b></span></div>
        </section>

        <footer>
          <span><T pt="Obrigado por ficar com a gente." en="Thank you for staying with us." /></span>
          <span>RGR · Artem Anália Franco</span>
        </footer>
      </main>
    </GuideShell>
  );
}
