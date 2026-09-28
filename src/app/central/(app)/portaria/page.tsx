import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { addDays, fmtShort, today, weekday } from "@/lib/util";
import { Channel, UnitCode } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { togglePortaria } from "../../actions";

export default async function Portaria() {
  const user = await requireUser("portaria");
  const d = today();
  const rows = await db()`
    SELECT r.id, r.guest_name, r.guests_count, r.guest_phone, r.check_in, r.check_out, r.channel, r.portaria_ok, u.code, u.apt
    FROM reservations r JOIN units u ON u.id = r.unit_id
    WHERE r.kind = 'reserva' AND r.status = 'confirmada' AND r.check_in >= ${d}::date AND r.check_in <= ${addDays(d, 7)}::date
    ORDER BY r.check_in, u.code`;
  const pending = rows.filter((r) => !r.portaria_ok);
  const canEdit = user.role !== "governanca";

  const text = [
    "Lista de hóspedes · Artem",
    ...Array.from(new Set(rows.map((r) => r.check_in))).map((day) =>
      [
        `\n${weekday(day)}, ${fmtShort(day)}`,
        ...rows
          .filter((r) => r.check_in === day)
          .map((r) => `• Apto ${r.apt ?? r.code}: ${r.guest_name ?? "[nome pendente]"}${r.guests_count ? ` (${r.guests_count} pessoas)` : ""}, saída ${fmtShort(r.check_out)}`),
      ].join("\n"),
    ),
  ].join("\n");

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Portaria</h1>
          <p>Entradas dos próximos 7 dias. {pending.length ? `${pending.length} ainda sem cadastro na portaria.` : "Todos cadastrados."}</p>
        </div>
        {rows.length > 0 && <CopyButton text={text} label="Copiar lista para a portaria" />}
      </div>

      <div className="two-col">
        <div className="panel table-wrap">
          <table className="t">
            <thead><tr><th>Entrada</th><th>Unidade</th><th>Hóspede</th><th>Canal</th><th>Saída</th><th>Portaria</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="empty">Nenhuma entrada nos próximos 7 dias.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{weekday(r.check_in)} {fmtShort(r.check_in)}</td>
                  <td><UnitCode code={r.code} /></td>
                  <td>
                    {canEdit ? <Link className="row-link" href={`/central/reservas/${r.id}`}>{r.guest_name ?? "Completar nome"}</Link> : r.guest_name ?? "—"}
                    {r.guests_count ? <span className="faint"> · {r.guests_count} pessoas</span> : null}
                  </td>
                  <td><Channel channel={r.channel} /></td>
                  <td>{fmtShort(r.check_out)}</td>
                  <td>
                    <form action={togglePortaria}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={`pill ${r.portaria_ok ? "good" : "warn"}`} style={{ cursor: "pointer" }} disabled={!canEdit}>
                        {r.portaria_ok ? "Cadastrado" : "Pendente"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="panel">
          <div className="panel-head"><h2>Texto para a portaria</h2></div>
          <div className="panel-body"><div className="copybox">{rows.length ? text : "Sem entradas previstas."}</div></div>
        </section>
      </div>
    </div>
  );
}
