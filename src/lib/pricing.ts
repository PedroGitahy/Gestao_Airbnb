import { db } from "./db";
import { addDays, getSettings, today, weekday } from "./util";

export type PriceDay = {
  date: string;
  booked: number;
  units: number;
  occupancy: number;
  lead: number;
  factors: { label: string; value: number }[];
  factor: number;
  price: number;
};

/**
 * Diária sugerida por dia para o studio padrão.
 * Regras transparentes, cada uma aparece na tela com o seu peso:
 * - ocupação do prédio naquela noite (demanda confirmada)
 * - antecedência (noites vazias perto da data baixam o preço para não ficarem vazias)
 * - dia da semana (sexta e sábado, ajustável)
 * - eventos cadastrados (feriados, shows, congressos)
 * O preço nunca fica abaixo do mínimo configurado.
 */
export async function suggestPrices(days = 60): Promise<{ base: number; min: number; rows: PriceDay[] }> {
  const sql = db();
  const s = await getSettings();
  const base = Number(s.default_price || 250);
  const min = Number(s.default_min_price || 0);
  const weekend = Number(s.weekend_factor || 1);
  const weekdayF = Number(s.weekday_factor || 1);
  const d0 = today();
  const end = addDays(d0, days);

  const [occ, events, [{ units }]] = await Promise.all([
    sql`
      SELECT g::date AS day, count(r.id)::int AS booked
      FROM generate_series(${d0}::date, ${end}::date - 1, interval '1 day') g
      LEFT JOIN reservations r ON r.status = 'confirmada' AND r.kind = 'reserva' AND r.check_in <= g::date AND r.check_out > g::date
      GROUP BY g ORDER BY g`,
    sql`SELECT name, date_from, date_to, factor FROM price_events WHERE date_to >= ${d0}::date AND date_from < ${end}::date`,
    sql`SELECT count(*)::int AS units FROM units WHERE active`,
  ]);

  const rows = occ.map((o) => {
    const date = String(o.day).slice(0, 10);
    const occupancy = units ? o.booked / units : 0;
    const lead = Math.round((Date.parse(date) - Date.parse(d0)) / 864e5);
    const factors: { label: string; value: number }[] = [];

    if (occupancy >= 0.9) factors.push({ label: "prédio quase cheio", value: 1.25 });
    else if (occupancy >= 0.75) factors.push({ label: "alta ocupação", value: 1.12 });
    else if (occupancy >= 0.6) factors.push({ label: "boa ocupação", value: 1.05 });
    else if (occupancy < 0.35 && lead <= 3) factors.push({ label: "vazio em cima da hora", value: 0.82 });
    else if (occupancy < 0.5 && lead <= 10) factors.push({ label: "ocupação baixa perto da data", value: 0.9 });

    const wd = weekday(date);
    if ((wd === "sex" || wd === "sáb") && weekend !== 1) factors.push({ label: "fim de semana", value: weekend });
    if (!["sex", "sáb"].includes(wd) && weekdayF !== 1) factors.push({ label: "dia útil", value: weekdayF });

    for (const e of events) {
      if (date >= e.date_from && date <= e.date_to) factors.push({ label: e.name, value: Number(e.factor) });
    }
    if (lead > 45 && occupancy < 0.2) factors.push({ label: "data distante", value: 1.05 });

    const factor = factors.reduce((p, f) => p * f.value, 1);
    const price = Math.max(min, Math.round((base * factor) / 5) * 5);
    return { date, booked: o.booked, units, occupancy, lead, factors, factor, price };
  });

  return { base, min, rows };
}
