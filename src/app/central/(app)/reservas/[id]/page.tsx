import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { diffDays, fmtDate, fmtShort, getSettings, money } from "@/lib/util";
import { Channel, CleaningPill, Flash, UnitCode } from "@/components/ui";
import { ReservationForm } from "@/components/ReservationForm";
import { CopyButton } from "@/components/CopyButton";

export default async function Reserva({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser("reservas");
  const { id } = await params;
  const sp = await searchParams;
  const rid = Number(id);
  if (!Number.isInteger(rid)) notFound();
  const sql = db();
  const [[r], units, settings, cleanings] = await Promise.all([
    sql`SELECT r.*, u.code, u.floor, u.apt, u.wifi_network, u.wifi_password, u.guide_token FROM reservations r JOIN units u ON u.id = r.unit_id WHERE r.id = ${rid}`,
    sql`SELECT id, code FROM units WHERE active ORDER BY code`,
    getSettings(),
    sql`SELECT c.id, c.date, c.type, c.status FROM cleanings c WHERE c.reservation_id = ${rid}`,
  ]);
  if (!r) notFound();

  const nights = diffDays(r.check_in, r.check_out);
  const gross = Number(r.gross ?? 0);
  const net = gross * (1 - Number(r.platform_fee_pct ?? 0)) - Number(r.cleaning_fee ?? 0);
  const first = (r.guest_name ?? "").split(" ")[0] || "[nome]";
  const site = process.env.SITE_URL ?? "";
  const guide = `${site}/guia/${r.guide_token}`;
  const sign = "Equipe RGR";

  const msgs = [
    {
      title: "Reserva confirmada",
      text: `Olá, ${first}. Sua estadia no Artem de ${fmtShort(r.check_in)} a ${fmtShort(r.check_out)} está confirmada.\n\nTrês dias antes da chegada envio o guia do apartamento, e na véspera, a senha de acesso. Se precisar de algo até lá, é só responder por aqui.\n\n${sign}`,
    },
    {
      title: "Boas-vindas (3 dias antes)",
      text: `Olá, ${first}. Faltam três dias para a sua chegada.\n\nNeste link está tudo sobre o apartamento e o bairro: ${guide}\n\nO check-in é a partir das ${settings.checkin_time} e é feito sem chaves, por senha. Você já sabe o horário aproximado em que chega?\n\n${sign}`,
    },
    {
      title: "Senha e chegada (véspera)",
      text: `Olá, ${first}. Está tudo pronto para amanhã.\n\nEndereço: Rua Antônio Alves Barril, 177 · Jardim Anália Franco\nPortaria: informe seu nome e o apartamento ${r.apt ?? "[número]"}.\nAndar: ${r.floor ?? "[andar]"}\nSenha da porta: [senha], válida a partir das ${settings.checkin_time}.\nWi-Fi: ${r.wifi_network ?? "[rede]"} · senha ${r.wifi_password ?? "[senha]"}\n\nGuia completo: ${guide}\n\n${sign}`,
    },
    {
      title: "Lembrete de saída",
      text: `Bom dia, ${first}. Hoje é dia de check-out, até as ${settings.checkout_time}.\n\nAntes de sair, só pedimos três coisas: desligar o ar-condicionado, deixar o lixo no cesto da cozinha e fechar bem a porta. Toalhas e roupa de cama podem ficar onde estão.\n\nFoi um prazer receber você.`,
    },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{r.kind === "bloqueio" ? "Bloqueio de datas" : r.guest_name || "Reserva sem nome"}</h1>
          <p style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <UnitCode code={r.code} /> <Channel channel={r.channel} kind={r.kind} /> {fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {nights} {nights === 1 ? "noite" : "noites"}
            {r.status === "cancelada" && <span className="pill bad">Cancelada</span>}
          </p>
        </div>
        <div className="actions">
          {r.external_url && <a className="btn" href={r.external_url} target="_blank" rel="noreferrer">Abrir na plataforma</a>}
          <Link className="btn" href="/central/reservas">Voltar</Link>
        </div>
      </div>
      <Flash sp={sp} />

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h2>Dados da reserva</h2>{r.source === "ical" && <span className="pill">datas vindas do iCal</span>}</div>
          <div className="panel-body">
            <ReservationForm units={units as never} r={r} />
          </div>
        </section>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Resumo</h2></div>
            <div className="panel-body">
              <dl className="kv">
                <dt>Valor</dt><dd className="num" style={{ textAlign: "left" }}>{money(gross)}</dd>
                <dt>Taxa</dt><dd>{r.platform_fee_pct != null ? `${(Number(r.platform_fee_pct) * 100).toFixed(1).replace(".", ",")}%` : "—"}</dd>
                <dt>Limpeza</dt><dd>{money(r.cleaning_fee)}</dd>
                <dt>Líquido</dt><dd><b>{money(net)}</b></dd>
                <dt>Diária</dt><dd>{nights ? money(gross / nights) : "—"}</dd>
                <dt>Portaria</dt><dd>{r.portaria_ok ? <span className="pill good">cadastrado</span> : <span className="pill warn">pendente</span>}</dd>
                <dt>Limpeza</dt>
                <dd>{cleanings.length ? cleanings.map((c) => <span key={c.id}>{fmtShort(c.date)} · <CleaningPill status={c.status} /></span>) : "—"}</dd>
              </dl>
            </div>
          </section>

          {r.kind === "reserva" && (
            <section className="panel">
              <div className="panel-head"><h2>Mensagens prontas</h2></div>
              <div className="panel-body stack" style={{ gap: 16 }}>
                {msgs.map((m) => (
                  <div key={m.title} style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="label">{m.title}</span>
                      <CopyButton text={m.text} />
                    </div>
                    <div className="copybox">{m.text}</div>
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
