import { db } from "./db";
import { addDays, diffDays, monthEnd, monthStart } from "./util";

export type UnitResult = {
  unit_id: number;
  code: string;
  nights: number;
  stays: number;
  gross: number;
  net: number;
  fixed: number;
  variable: number;
  result: number;
  rating: number | null;
};

/**
 * Resultado do mês por unidade. Receita e noites são rateadas pelas noites
 * que caem dentro do mês (uma estadia de 28/01 a 03/02 divide-se entre os dois meses).
 * Custos "Geral" (sem unidade) são divididos igualmente entre as unidades ativas.
 */
export async function monthResults(anyDay: string) {
  const sql = db();
  const start = monthStart(anyDay);
  const endExcl = addDays(monthEnd(anyDay), 1);
  const days = diffDays(start, endExcl);

  const rows = await sql`
    WITH r AS (
      SELECT unit_id,
        (check_out - check_in) AS nights_total,
        GREATEST(0, LEAST(check_out, ${endExcl}::date) - GREATEST(check_in, ${start}::date)) AS nights_in,
        COALESCE(gross, 0) AS gross,
        COALESCE(gross, 0) * (1 - COALESCE(platform_fee_pct, 0)) - COALESCE(cleaning_fee, 0) AS net,
        rating, check_in
      FROM reservations
      WHERE kind = 'reserva' AND status = 'confirmada'
        AND check_in < ${endExcl}::date AND check_out > ${start}::date
    ),
    agg AS (
      SELECT unit_id,
        SUM(nights_in)::int AS nights,
        COUNT(*) FILTER (WHERE check_in >= ${start}::date)::int AS stays,
        SUM(gross * nights_in / NULLIF(nights_total, 0)) AS gross,
        SUM(net * nights_in / NULLIF(nights_total, 0)) AS net,
        AVG(rating) AS rating
      FROM r GROUP BY unit_id
    ),
    exp AS (
      SELECT unit_id, SUM(amount) AS amount FROM expenses
      WHERE date >= ${start}::date AND date < ${endExcl}::date GROUP BY unit_id
    ),
    active AS (SELECT count(*) AS n FROM units WHERE active)
    SELECT u.id AS unit_id, u.code,
      COALESCE(a.nights, 0) AS nights,
      COALESCE(a.stays, 0) AS stays,
      COALESCE(a.gross, 0)::float AS gross,
      COALESCE(a.net, 0)::float AS net,
      (u.condo_fee + u.iptu + u.internet)::float AS fixed,
      (COALESCE(e.amount, 0) + COALESCE((SELECT amount FROM exp WHERE unit_id IS NULL), 0) / GREATEST((SELECT n FROM active), 1))::float AS variable,
      a.rating::float AS rating
    FROM units u
    LEFT JOIN agg a ON a.unit_id = u.id
    LEFT JOIN exp e ON e.unit_id = u.id
    WHERE u.active
    ORDER BY u.code`;

  const units: UnitResult[] = rows.map((r) => ({
    unit_id: r.unit_id,
    code: r.code,
    nights: Number(r.nights),
    stays: Number(r.stays),
    gross: Number(r.gross),
    net: Number(r.net),
    fixed: Number(r.fixed),
    variable: Number(r.variable),
    result: Number(r.net) - Number(r.fixed) - Number(r.variable),
    rating: r.rating === null ? null : Number(r.rating),
  }));

  const nights = units.reduce((s, u) => s + u.nights, 0);
  const gross = units.reduce((s, u) => s + u.gross, 0);
  const net = units.reduce((s, u) => s + u.net, 0);
  const result = units.reduce((s, u) => s + u.result, 0);
  const available = units.length * days;
  const rated = units.filter((u) => u.rating !== null);

  return {
    start,
    days,
    units,
    totals: {
      nights,
      gross,
      net,
      result,
      fixed: units.reduce((s, u) => s + u.fixed, 0),
      variable: units.reduce((s, u) => s + u.variable, 0),
      occupancy: available ? nights / available : 0,
      adr: nights ? gross / nights : 0,
      revpar: available ? gross / available : 0,
      rating: rated.length ? rated.reduce((s, u) => s + (u.rating ?? 0), 0) / rated.length : null,
    },
  };
}
