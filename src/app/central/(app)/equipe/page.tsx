import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL, MODULES, type Role } from "@/lib/roles";
import { Flash } from "@/components/ui";
import { createUserAction, updateUserAction } from "../../actions";

const ROLES = Object.keys(ROLE_LABEL) as Role[];

export default async function Equipe({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await requireUser("equipe");
  const sp = await searchParams;
  const users = await db()`SELECT id, name, email, phone, role, active FROM users ORDER BY active DESC, role, name`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Equipe</h1>
          <p>Cada perfil vê só o que precisa. A camareira, por exemplo, abre direto na escala de limpeza.</p>
        </div>
      </div>
      <Flash sp={sp} />
      <div className="two-col">
        <div className="panel">
          <div className="list">
            {users.map((u) => (
              <form key={u.id} action={updateUserAction} className="list-item" style={{ flexWrap: "wrap", opacity: u.active ? 1 : 0.6 }}>
                <input type="hidden" name="id" value={u.id} />
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div className="title">{u.name}</div>
                  <div className="meta mono">{u.email}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <select name="role" defaultValue={u.role} aria-label={`Perfil de ${u.name}`} style={{ width: 140, padding: "6px 8px", fontSize: 13 }}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <input name="phone" defaultValue={u.phone ?? ""} placeholder="WhatsApp" aria-label="WhatsApp" style={{ width: 140, padding: "6px 8px", fontSize: 13 }} />
                  <input name="password" type="password" placeholder="Nova senha" aria-label="Nova senha" autoComplete="new-password" style={{ width: 130, padding: "6px 8px", fontSize: 13 }} />
                  <label className="check" style={{ fontSize: 13 }}><input type="checkbox" name="active" defaultChecked={u.active} /> ativo</label>
                  <button className="btn btn-small" type="submit">Salvar</button>
                </div>
              </form>
            ))}
          </div>
        </div>

        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h2>Adicionar pessoa</h2></div>
            <form action={createUserAction} className="form panel-body">
              <div className="field"><label htmlFor="n-name">Nome</label><input id="n-name" name="name" required /></div>
              <div className="field"><label htmlFor="n-email">E-mail de acesso</label><input id="n-email" name="email" type="email" required /></div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="n-role">Perfil</label>
                  <select id="n-role" name="role" defaultValue="camareira">
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </div>
                <div className="field"><label htmlFor="n-phone">WhatsApp</label><input id="n-phone" name="phone" /></div>
              </div>
              <div className="field"><label htmlFor="n-pass">Senha inicial</label><input id="n-pass" name="password" type="password" minLength={8} required autoComplete="new-password" /><small>Mínimo de 8 caracteres. Passe para a pessoa por um canal privado.</small></div>
              <div><button className="btn btn-primary" type="submit">Adicionar</button></div>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head"><h2>O que cada perfil acessa</h2></div>
            <div className="table-wrap">
              <table className="t">
                <thead><tr><th>Módulo</th>{ROLES.map((r) => <th key={r} style={{ textAlign: "center" }}>{ROLE_LABEL[r]}</th>)}</tr></thead>
                <tbody>
                  {MODULES.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      {ROLES.map((r) => <td key={r} style={{ textAlign: "center" }}>{m.roles.includes(r) ? "●" : <span className="faint">–</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
