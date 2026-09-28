import { db } from "./db";
import { fmtShort, getSettings } from "./util";

export const TRIGGERS: Record<string, { label: string; help: string }> = {
  reserva: { label: "Ao confirmar a reserva", help: "minutos depois que a reserva entra" },
  antes_entrada: { label: "Dias antes da entrada", help: "N dias antes do check-in" },
  entrada: { label: "No dia da entrada", help: "no dia do check-in" },
  durante: { label: "Durante a estadia", help: "N dias depois do check-in" },
  saida: { label: "No dia da saída", help: "no dia do check-out" },
  apos_saida: { label: "Depois da saída", help: "N dias depois do check-out" },
};

export const PLACEHOLDERS = ["nome", "unidade", "apto", "andar", "entrada", "saida", "checkin", "checkout", "guia", "wifi_rede", "wifi_senha", "senha_porta", "central"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderMessage(body: string, r: Record<string, any>, s: Record<string, string>) {
  const site = process.env.SITE_URL ?? "";
  const values: Record<string, string | null> = {
    nome: (r.guest_name ?? "").split(" ")[0] || null,
    unidade: r.code ?? null,
    apto: r.apt ?? null,
    andar: r.floor ?? null,
    entrada: r.check_in ? fmtShort(r.check_in) : null,
    saida: r.check_out ? fmtShort(r.check_out) : null,
    checkin: s.checkin_time || "15h",
    checkout: s.checkout_time || "11h",
    guia: r.guide_token ? `${site}/guia/${r.guide_token}` : null,
    wifi_rede: r.wifi_network ?? null,
    wifi_senha: r.wifi_password ?? null,
    senha_porta: r.door_code ?? null,
    central: s.whatsapp_central || null,
  };
  const missing: string[] = [];
  const text = body.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in values)) return m;
    const v = values[k];
    if (!v) {
      missing.push(k);
      return `[${k.replace(/_/g, " ")}]`;
    }
    return v;
  });
  return { text, missing };
}

export function waLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const n = digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}

/** Cria (ou reagenda) as mensagens de cada reserva ativa conforme os modelos. */
export async function planMessages() {
  const sql = db();
  await sql`
    WITH base AS (
      SELECT r.id AS rid, t.id AS tid, t.trigger, t.offset_days, t.send_time, r.check_in, r.check_out, r.created_at
      FROM reservations r CROSS JOIN message_templates t
      WHERE t.active AND r.kind = 'reserva' AND r.status = 'confirmada' AND r.check_out >= CURRENT_DATE - 3
        -- na primeira sincronização, reservas antigas das plataformas não recebem "reserva confirmada"
        AND NOT (t.trigger = 'reserva' AND r.source = 'ical'
                 AND r.created_at < (SELECT min(ran_at) FROM sync_log WHERE ok) + interval '10 minutes')
    ),
    sched AS (
      SELECT rid, tid,
        CASE trigger
          WHEN 'reserva' THEN created_at + interval '5 minutes'
          ELSE ((CASE trigger
                  WHEN 'antes_entrada' THEN check_in - offset_days
                  WHEN 'entrada' THEN check_in
                  WHEN 'durante' THEN check_in + offset_days
                  WHEN 'saida' THEN check_out
                  ELSE check_out + offset_days END)::text || ' ' || send_time)::timestamp AT TIME ZONE 'America/Sao_Paulo'
        END AS at,
        trigger, check_in, check_out, offset_days
      FROM base
    )
    INSERT INTO message_log (reservation_id, template_id, scheduled_for)
    SELECT rid, tid, at FROM sched
    WHERE at > now() - interval '6 hours'
      AND NOT (trigger = 'durante' AND check_in + offset_days >= check_out)
    ON CONFLICT (reservation_id, template_id) DO UPDATE
      SET scheduled_for = EXCLUDED.scheduled_for
      WHERE message_log.status = 'agendada' AND message_log.scheduled_for <> EXCLUDED.scheduled_for`;

  await sql`
    UPDATE message_log m SET status = 'ignorada', note = 'Reserva cancelada'
    FROM reservations r WHERE m.reservation_id = r.id AND m.status = 'agendada' AND (r.status = 'cancelada' OR r.kind = 'bloqueio')`;
}

export function evolutionReady() {
  return Boolean(process.env.EVOLUTION_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
}

async function sendWhatsApp(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
  const url = `${process.env.EVOLUTION_URL!.replace(/\/$/, "")}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify({ number, text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Evolution respondeu ${res.status}`);
}

/** Envia o que venceu. Sem telefone, senha ou envio automático, a mensagem vai para a fila manual. */
export async function processDueMessages() {
  const sql = db();
  const s = await getSettings();
  const auto = s.auto_messages === "on" && evolutionReady();
  const due = await sql`
    SELECT r.*, m.id AS log_id, t.body, u.code, u.apt, u.floor, u.wifi_network, u.wifi_password, u.guide_token
    FROM message_log m
    JOIN message_templates t ON t.id = m.template_id
    JOIN reservations r ON r.id = m.reservation_id
    JOIN units u ON u.id = r.unit_id
    WHERE m.status = 'agendada' AND m.scheduled_for <= now()
    ORDER BY m.scheduled_for LIMIT 50`;

  for (const row of due) {
    const { text, missing } = renderMessage(row.body, row, s);
    let status = "manual";
    let note: string | null = null;
    const gaps = [...(row.guest_phone ? [] : ["WhatsApp do hóspede"]), ...missing.map((m) => m.replace(/_/g, " "))];
    if (gaps.length) note = `Falta preencher: ${gaps.join(", ")}`;
    else if (!auto) note = "Envio automático desligado";
    else {
      try {
        await sendWhatsApp(row.guest_phone, text);
        status = "enviada";
      } catch (e) {
        status = "falhou";
        note = e instanceof Error ? e.message : String(e);
      }
    }
    await sql`UPDATE message_log SET status = ${status}, body = ${text}, note = ${note}, sent_at = ${status === "enviada" ? new Date() : null} WHERE id = ${row.log_id}`;
  }
  return due.length;
}
