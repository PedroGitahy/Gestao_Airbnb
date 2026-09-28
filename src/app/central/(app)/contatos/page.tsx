import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime, fmtShort } from "@/lib/util";
import { setLeadStatus } from "../../actions";

const STATUS: Record<string, [string, string]> = {
  novo: ["warn", "Novo"],
  respondido: ["info", "Respondido"],
  fechado: ["good", "Fechado"],
  perdido: ["", "Perdido"],
};

export default async function Contatos({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  await requireUser("contatos");
  const sp = await searchParams;
  const view = sp.v && STATUS[sp.v] ? sp.v : "todos";
  const sql = db();
  const rows = await sql`SELECT * FROM leads ${view !== "todos" ? sql`WHERE status = ${view}` : sql``} ORDER BY created_at DESC LIMIT 200`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Contatos do site</h1>
          <p>Pedidos de reserva direta e estadias longas enviados pelo formulário do site.</p>
        </div>
      </div>
      <div className="filters">
        <Link href="/central/contatos" aria-current={view === "todos" ? "true" : undefined}>Todos</Link>
        {Object.entries(STATUS).map(([k, [, l]]) => (
          <Link key={k} href={`/central/contatos?v=${k}`} aria-current={view === k ? "true" : undefined}>{l}</Link>
        ))}
      </div>
      <div className="panel">
        {rows.length === 0 ? (
          <div className="empty">Nenhum contato por enquanto.</div>
        ) : (
          <div className="list">
            {rows.map((l) => {
              const wa = l.phone ? `https://wa.me/${String(l.phone).replace(/\D/g, "")}` : null;
              return (
                <div key={l.id} className="list-item" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                    <div className="title">{l.name}{l.reason ? <span className="faint"> · {l.reason}</span> : null}</div>
                    <div className="meta">
                      {l.check_in ? `${fmtShort(l.check_in)} → ${fmtShort(l.check_out)}` : "sem datas"}
                      {l.guests ? ` · ${l.guests} pessoas` : ""} · recebido {fmtDateTime(l.created_at)}
                    </div>
                    <div className="meta">
                      {l.email && <span className="mono" style={{ userSelect: "all" }}>{l.email}</span>}
                      {l.email && l.phone ? " · " : ""}
                      {l.phone && <span className="mono" style={{ userSelect: "all" }}>{l.phone}</span>}
                    </div>
                    {l.message && <p style={{ margin: "8px 0 0", fontSize: 14 }}>{l.message}</p>}
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {wa && <a className="btn btn-small" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                    <form action={setLeadStatus} style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="id" value={l.id} />
                      <select name="status" defaultValue={l.status} aria-label="Situação" style={{ padding: "6px 8px", fontSize: 13 }}>
                        {Object.entries(STATUS).map(([k, [, lab]]) => <option key={k} value={k}>{lab}</option>)}
                      </select>
                      <button className="btn btn-small" type="submit">Salvar</button>
                    </form>
                    <span className={`pill ${STATUS[l.status][0]}`}>{STATUS[l.status][1]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
