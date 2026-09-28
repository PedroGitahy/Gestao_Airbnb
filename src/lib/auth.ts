import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { ensureDatabase } from "./schema";
import { can, homeFor, type ModuleKey, type Role } from "./roles";

export const COOKIE = "rgr_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 dias

export type SessionUser = { id: number; name: string; role: Role; email: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET ausente ou curta demais");
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser) {
  const jwt = await new SignJWT({ name: user.name, role: user.role, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function readSession(token?: string): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      id: Number(payload.sub),
      name: String(payload.name),
      role: payload.role as Role,
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

/** Usuário logado (conferido no banco para respeitar desativações). */
export async function currentUser(): Promise<SessionUser | null> {
  const s = await readSession((await cookies()).get(COOKIE)?.value);
  if (!s) return null;
  await ensureDatabase();
  const [u] = await db()`SELECT id, name, email, role, active FROM users WHERE id = ${s.id}`;
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

/** Exige login e, se informado, permissão ao módulo. */
export async function requireUser(module?: ModuleKey): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect("/central/login");
  if (module && !can(u.role, module)) redirect(homeFor(u.role));
  return u;
}

export async function checkPassword(email: string, password: string): Promise<SessionUser | null> {
  await ensureDatabase();
  const [u] = await db()`SELECT id, name, email, role, password_hash, active FROM users WHERE lower(email) = ${email.toLowerCase().trim()}`;
  if (!u || !u.active) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  return ok ? { id: u.id, name: u.name, email: u.email, role: u.role } : null;
}

export async function hashPassword(p: string) {
  return bcrypt.hash(p, 10);
}
