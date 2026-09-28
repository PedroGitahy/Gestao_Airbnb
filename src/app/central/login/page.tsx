import { redirect } from "next/navigation";
import { checkPassword, createSession, currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const user = await checkPassword(email, password);
  if (!user) redirect("/central/login?erro=1");
  await createSession(user);
  redirect(homeFor(user.role));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const u = await currentUser().catch(() => null);
  if (u) redirect(homeFor(u.role));
  const { erro } = await searchParams;
  return (
    <div className="login-wrap">
      <form action={login} className="login form">
        <div>
          <span className="eyebrow">Central RGR · Artem</span>
          <h1>Entrar</h1>
          <p>Use o e-mail e a senha que o gestor cadastrou para você.</p>
        </div>
        {erro && <div className="flash err">E-mail ou senha não conferem. Confira e tente de novo.</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn btn-primary" type="submit">Entrar</button>
      </form>
    </div>
  );
}
