import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, destroySession } from "@/lib/auth";
import { MODULES, ROLE_LABEL } from "@/lib/roles";
import { db } from "@/lib/db";
import { today } from "@/lib/util";
import { Nav, type NavItem } from "@/components/Nav";

export const dynamic = "force-dynamic";

async function logout() {
  "use server";
  await destroySession();
  redirect("/central/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const sql = db();
  const [counts] = await sql`
    SELECT
      (SELECT count(*) FROM tickets WHERE status <> 'resolvida' AND due_at < now())::int AS overdue,
      (SELECT count(*) FROM leads WHERE status = 'novo')::int AS leads,
      (SELECT count(*) FROM cleanings WHERE date = ${today()} AND status IN ('pendente','em_andamento'))::int AS cleanings,
      (SELECT count(*) FROM message_log WHERE status IN ('manual','falhou'))::int AS msgs,
      (SELECT count(*) FROM reviews WHERE NOT responded)::int AS reviews`;

  const badges: Record<string, number> = {
    manutencao: counts.overdue,
    contatos: counts.leads,
    limpeza: counts.cleanings,
    mensagens: counts.msgs,
    avaliacoes: counts.reviews,
  };
  const items: NavItem[] = MODULES.filter((m) => m.roles.includes(user.role)).map((m) => ({
    href: m.href,
    label: m.label,
    group: m.group,
    badge: badges[m.key],
  }));

  const foot = (
    <div className="side-foot">
      <span>
        <b>{user.name}</b>
        <br />
        <span className="muted">{ROLE_LABEL[user.role]}</span>
      </span>
      <Link href="/" className="muted" target="_blank">Ver site público</Link>
      <form action={logout}>
        <button type="submit">Sair</button>
      </form>
    </div>
  );

  return (
    <div className="shell">
      <aside className="side">
        <Link href="/central" className="brand">
          <b>RGR</b>
          <span>Artem</span>
        </Link>
        <Nav items={items} />
        {foot}
      </aside>
      <div>
        <header className="topbar">
          <Link href="/central" className="brand">
            <b>RGR</b>
            <span>Artem</span>
          </Link>
          <details>
            <summary>Menu</summary>
            <div className="menu">
              <Nav items={items} />
              {foot}
            </div>
          </details>
        </header>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
