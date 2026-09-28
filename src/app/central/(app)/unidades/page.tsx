import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, money } from "@/lib/util";
import { UnitCode } from "@/components/ui";

export default async function Unidades() {
  await requireUser("unidades");
  const rows = await db()`
    SELECT u.*,
      (SELECT ok FROM sync_log s WHERE s.unit_id = u.id ORDER BY ran_at DESC LIMIT 1) AS last_ok,
      (SELECT ran_at FROM sync_log s WHERE s.unit_id = u.id ORDER BY ran_at DESC LIMIT 1) AS last_sync
    FROM units u ORDER BY u.code`;
  const withIcal = rows.filter((u) => u.ical_airbnb || u.ical_booking).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Unidades</h1>
          <p>{rows.length} apartamentos · {withIcal} com calendário conectado. Abra uma unidade para editar dados, Wi-Fi e links iCal.</p>
        </div>
      </div>
      <div className="panel table-wrap">
        <table className="t">
          <thead>
            <tr><th>Unidade</th><th>Apto</th><th>Andar</th><th className="num">Pessoas</th><th>Calendários</th><th>Última sincronização</th><th className="num">Fixos / mês</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                <td><Link href={`/central/unidades/${u.id}`} className="row-link"><UnitCode code={u.code} /></Link></td>
                <td>{u.apt ?? <span className="faint">—</span>}</td>
                <td>{u.floor ?? <span className="faint">—</span>}</td>
                <td className="num">{u.capacity}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  {u.ical_airbnb ? <span className="ch airbnb">Airbnb</span> : null}
                  {u.ical_booking ? <span className="ch booking">Booking</span> : null}
                  {!u.ical_airbnb && !u.ical_booking ? <span className="pill warn">sem link</span> : null}
                </td>
                <td>{u.last_sync ? <span className={`pill ${u.last_ok ? "good" : "bad"}`}>{fmtDateTime(u.last_sync)}</span> : <span className="faint">—</span>}</td>
                <td className="num">{money(Number(u.condo_fee) + Number(u.iptu) + Number(u.internet))}</td>
                <td><Link className="btn-link" href={`/central/unidades/${u.id}`}>Editar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
