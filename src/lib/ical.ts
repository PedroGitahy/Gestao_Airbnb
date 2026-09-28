import { db } from "./db";
import { regenerateCleanings } from "./cleanings";
import { today } from "./util";

export type IcalEvent = {
  uid: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  summary: string;
  description: string;
};

function toIsoDate(v: string): string | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

/** Leitor enxuto de iCal (VEVENT com datas de dia inteiro, como Airbnb e Booking enviam). */
export function parseIcal(text: string): IcalEvent[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: IcalEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT") {
      if (cur) {
        const start = toIsoDate(cur.DTSTART || "");
        const end = toIsoDate(cur.DTEND || "") || (start ? start : null);
        if (cur.UID && start && end && end > start) {
          out.push({ uid: cur.UID, start, end, summary: unescape(cur.SUMMARY || ""), description: unescape(cur.DESCRIPTION || "") });
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i).split(";")[0].toUpperCase();
      cur[key] = line.slice(i + 1);
    }
  }
  return out;
}

function classify(channel: "airbnb" | "booking", ev: IcalEvent): "reserva" | "bloqueio" {
  const s = ev.summary.toLowerCase();
  if (channel === "airbnb") return s.includes("reserved") ? "reserva" : "bloqueio";
  // O Booking marca reservas e bloqueios do mesmo jeito ("CLOSED - Not available").
  return "reserva";
}

async function fetchText(url: string) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "RGR-Central/1.0" }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function syncUnitChannel(unitId: number, channel: "airbnb" | "booking", url: string) {
  const sql = db();
  try {
    const events = parseIcal(await fetchText(url));
    const seen: string[] = [];
    for (const ev of events) {
      seen.push(ev.uid);
      const kind = classify(channel, ev);
      const link = ev.description.match(/https?:\/\/\S+/)?.[0] ?? null;
      const code = link?.match(/details\/([A-Z0-9]{6,})/i)?.[1]?.toUpperCase() ?? null;
      await sql`
        INSERT INTO reservations (unit_id, channel, kind, external_uid, source, check_in, check_out, external_url, confirmation_code, platform_fee_pct)
        VALUES (${unitId}, ${channel}, ${kind}, ${ev.uid}, 'ical', ${ev.start}, ${ev.end}, ${link}, ${code},
          (SELECT value::numeric FROM settings WHERE key = ${channel + "_fee"}))
        ON CONFLICT (unit_id, channel, external_uid) WHERE external_uid IS NOT NULL DO UPDATE
          SET check_in = EXCLUDED.check_in,
              check_out = EXCLUDED.check_out,
              kind = EXCLUDED.kind,
              external_url = COALESCE(EXCLUDED.external_url, reservations.external_url),
              confirmation_code = COALESCE(EXCLUDED.confirmation_code, reservations.confirmation_code),
              status = 'confirmada',
              updated_at = now()
          WHERE reservations.check_in <> EXCLUDED.check_in
             OR reservations.check_out <> EXCLUDED.check_out
             OR reservations.kind <> EXCLUDED.kind
             OR reservations.status <> 'confirmada'
             OR (EXCLUDED.confirmation_code IS NOT NULL AND reservations.confirmation_code IS DISTINCT FROM EXCLUDED.confirmation_code)`;
    }
    // sumiu do calendário e ainda não começou: foi cancelada na plataforma
    await sql`
      UPDATE reservations SET status = 'cancelada', updated_at = now()
      WHERE unit_id = ${unitId} AND channel = ${channel} AND source = 'ical'
        AND status = 'confirmada' AND check_in >= ${today()}
        AND NOT (external_uid = ANY(${seen}))`;
    await sql`INSERT INTO sync_log (unit_id, channel, ok, events, message) VALUES (${unitId}, ${channel}, true, ${events.length}, null)`;
    return { ok: true, events: events.length };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`INSERT INTO sync_log (unit_id, channel, ok, message) VALUES (${unitId}, ${channel}, false, ${msg.slice(0, 300)})`;
    return { ok: false, error: msg };
  }
}

let running = false;

/** Sincroniza todas as unidades com link iCal cadastrado. */
export async function syncAll() {
  if (running) return { skipped: true, feeds: 0, errors: 0 };
  running = true;
  try {
    const sql = db();
    const units = await sql`SELECT id, ical_airbnb, ical_booking FROM units WHERE active`;
    let feeds = 0;
    let errors = 0;
    for (const u of units) {
      for (const ch of ["airbnb", "booking"] as const) {
        const url = u[`ical_${ch}`] as string | null;
        if (!url) continue;
        feeds++;
        const r = await syncUnitChannel(u.id, ch, url);
        if (!r.ok) errors++;
      }
    }
    await regenerateCleanings();
    await sql`DELETE FROM sync_log WHERE ran_at < now() - interval '30 days'`;
    return { skipped: false, feeds, errors };
  } finally {
    running = false;
  }
}

/** Calendário de saída: bloqueia no Airbnb/Booking as reservas diretas e as da outra plataforma. */
export function buildIcal(unitCode: string, rows: { id: number; check_in: string; check_out: string; channel: string }[]) {
  const d = (iso: string) => iso.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const body = rows
    .map(
      (r) =>
        `BEGIN:VEVENT\r\nUID:rgr-${r.id}@rgr-artem\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${d(r.check_in)}\r\nDTEND;VALUE=DATE:${d(r.check_out)}\r\nSUMMARY:Indisponível (${r.channel})\r\nEND:VEVENT`,
    )
    .join("\r\n");
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//RGR//Artem ${unitCode}//PT\r\nCALSCALE:GREGORIAN\r\n${body}${body ? "\r\n" : ""}END:VCALENDAR\r\n`;
}
