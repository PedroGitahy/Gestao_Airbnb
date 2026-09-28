import { db } from "./db";
import { addDays, today } from "./util";

/**
 * Gera ou atualiza a limpeza automática de cada reserva (no dia do check-out).
 * Se outra reserva entra na mesma unidade no mesmo dia, vira "saída + entrada".
 * Nunca mexe no status de uma limpeza já iniciada.
 */
export async function regenerateCleanings() {
  const sql = db();
  const from = addDays(today(), -7);

  await sql`
    INSERT INTO cleanings (unit_id, reservation_id, date, type, auto)
    SELECT r.unit_id, r.id, r.check_out,
      CASE WHEN EXISTS (
        SELECT 1 FROM reservations n
        WHERE n.unit_id = r.unit_id AND n.id <> r.id AND n.kind = 'reserva'
          AND n.status = 'confirmada' AND n.check_in = r.check_out
      ) THEN 'saida_entrada' ELSE 'saida' END,
      true
    FROM reservations r
    WHERE r.kind = 'reserva' AND r.status = 'confirmada' AND r.check_out >= ${from}
    ON CONFLICT (reservation_id) WHERE auto DO UPDATE
      SET date = EXCLUDED.date,
          type = EXCLUDED.type,
          unit_id = EXCLUDED.unit_id,
          status = CASE WHEN cleanings.status = 'cancelada' THEN 'pendente' ELSE cleanings.status END,
          updated_at = now()
      WHERE cleanings.date IS DISTINCT FROM EXCLUDED.date
         OR cleanings.type IS DISTINCT FROM EXCLUDED.type
         OR cleanings.unit_id IS DISTINCT FROM EXCLUDED.unit_id
         OR cleanings.status = 'cancelada'`;

  // reservas canceladas ou viradas bloqueio: limpeza pendente é cancelada
  await sql`
    UPDATE cleanings c SET status = 'cancelada', updated_at = now()
    FROM reservations r
    WHERE c.reservation_id = r.id AND c.auto AND c.status = 'pendente'
      AND (r.status = 'cancelada' OR r.kind = 'bloqueio')`;
}
