"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { regenerateCleanings } from "@/lib/cleanings";
import { syncAll } from "@/lib/ical";
import { EXPENSE_CATEGORIES, PRIORITY, num, str } from "@/lib/util";
import type { Role } from "@/lib/roles";

const back = (path: string, msg: string, kind: "ok" | "erro" = "ok") =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

/* ——— Reservas ——— */

export async function saveReservation(fd: FormData) {
  await requireUser("reservas");
  const sql = db();
  const id = num(fd.get("id"));
  const unit_id = num(fd.get("unit_id"));
  const check_in = str(fd.get("check_in"));
  const check_out = str(fd.get("check_out"));
  if (!unit_id || !check_in || !check_out || check_out <= check_in) {
    back(id ? `/central/reservas/${id}` : "/central/reservas/nova", "Confira a unidade e as datas: a saída precisa ser depois da entrada.", "erro");
  }
  const channel = str(fd.get("channel")) ?? "direto";
  const feePct = num(fd.get("platform_fee_pct"));
  const data = {
    unit_id,
    channel,
    kind: str(fd.get("kind")) ?? "reserva",
    guest_name: str(fd.get("guest_name")),
    guest_phone: str(fd.get("guest_phone")),
    guest_email: str(fd.get("guest_email")),
    guests_count: num(fd.get("guests_count")),
    check_in,
    check_out,
    gross: num(fd.get("gross")),
    platform_fee_pct: feePct === null ? null : feePct > 1 ? feePct / 100 : feePct,
    cleaning_fee: num(fd.get("cleaning_fee")),
    status: str(fd.get("status")) ?? "confirmada",
    rating: num(fd.get("rating")),
    notes: str(fd.get("notes")),
  };

  // conflito de datas com outra reserva confirmada na mesma unidade
  const [clash] = await sql`
    SELECT id, check_in, check_out FROM reservations
    WHERE unit_id = ${data.unit_id} AND status = 'confirmada' AND id <> ${id ?? 0}
      AND check_in < ${data.check_out} AND check_out > ${data.check_in}
    LIMIT 1`;
  if (clash && data.status === "confirmada") {
    back(id ? `/central/reservas/${id}` : "/central/reservas/nova", `Essas datas se sobrepõem à reserva #${clash.id} na mesma unidade.`, "erro");
  }

  let rid = id;
  if (id) {
    await sql`UPDATE reservations SET ${sql(data)}, updated_at = now() WHERE id = ${id}`;
  } else {
    if (data.platform_fee_pct === null && channel !== "direto") {
      const [s] = await sql`SELECT value FROM settings WHERE key = ${channel + "_fee"}`;
      data.platform_fee_pct = s ? Number(s.value) : null;
    }
    const [r] = await sql`INSERT INTO reservations ${sql(data)} RETURNING id`;
    rid = r.id;
  }
  await regenerateCleanings();
  revalidatePath("/central", "layout");
  back(`/central/reservas/${rid}`, "Reserva salva.");
}

export async function togglePortaria(fd: FormData) {
  await requireUser("portaria");
  const id = num(fd.get("id"));
  await db()`UPDATE reservations SET portaria_ok = NOT portaria_ok, updated_at = now() WHERE id = ${id}`;
  revalidatePath("/central/portaria");
}

export async function syncNow() {
  await requireUser("reservas");
  const r = await syncAll();
  revalidatePath("/central", "layout");
  if (r.skipped) back("/central/reservas", "Uma sincronização já está em andamento. Tente em um minuto.", "erro");
  if (!r.feeds) back("/central/reservas", "Nenhum link iCal cadastrado ainda. Cadastre em Unidades.", "erro");
  back("/central/reservas", `Sincronizado: ${r.feeds} calendários${r.errors ? `, ${r.errors} com erro (veja em Unidades)` : ""}.`, r.errors ? "erro" : "ok");
}

/* ——— Limpeza ——— */

export async function setCleaningStatus(fd: FormData) {
  const u = await requireUser("limpeza");
  const id = num(fd.get("id"));
  const status = str(fd.get("status"));
  if (!["pendente", "em_andamento", "pronta", "vistoriada", "cancelada"].includes(status ?? "")) return;
  if (status === "vistoriada" && u.role === "camareira") return; // vistoria é da governança
  const sql = db();
  if (status === "vistoriada") {
    await sql`UPDATE cleanings SET status = ${status}, checked_by = ${u.id}, updated_at = now() WHERE id = ${id}`;
  } else if (status === "em_andamento" && u.role === "camareira") {
    await sql`UPDATE cleanings SET status = ${status}, assignee_id = COALESCE(assignee_id, ${u.id}), updated_at = now() WHERE id = ${id}`;
  } else {
    await sql`UPDATE cleanings SET status = ${status}, updated_at = now() WHERE id = ${id}`;
  }
  revalidatePath("/central", "layout");
}

export async function assignCleaning(fd: FormData) {
  const u = await requireUser("limpeza");
  if (u.role === "camareira") return;
  const id = num(fd.get("id"));
  const assignee = num(fd.get("assignee_id"));
  await db()`UPDATE cleanings SET assignee_id = ${assignee}, updated_at = now() WHERE id = ${id}`;
  revalidatePath("/central/limpeza");
}

export async function createCleaning(fd: FormData) {
  const u = await requireUser("limpeza");
  if (u.role === "camareira") return;
  const unit_id = num(fd.get("unit_id"));
  const date = str(fd.get("date"));
  const type = str(fd.get("type")) ?? "profunda";
  if (!unit_id || !date) back("/central/limpeza", "Escolha a unidade e a data.", "erro");
  await db()`INSERT INTO cleanings (unit_id, date, type, notes, assignee_id) VALUES (${unit_id}, ${date}, ${type}, ${str(fd.get("notes"))}, ${num(fd.get("assignee_id"))})`;
  revalidatePath("/central", "layout");
  back(`/central/limpeza?data=${date}`, "Limpeza agendada.");
}

/* ——— Manutenção ——— */

export async function createTicket(fd: FormData) {
  const u = await requireUser("manutencao");
  const priority = str(fd.get("priority")) ?? "p3";
  const title = str(fd.get("title"));
  if (!title || !PRIORITY[priority]) back("/central/manutencao", "Descreva a ocorrência em poucas palavras.", "erro");
  const due = new Date(Date.now() + PRIORITY[priority].hours * 3600_000);
  await db()`
    INSERT INTO tickets (unit_id, priority, title, description, assignee, opened_by, due_at)
    VALUES (${num(fd.get("unit_id"))}, ${priority}, ${title}, ${str(fd.get("description"))}, ${str(fd.get("assignee"))}, ${u.id}, ${due})`;
  revalidatePath("/central", "layout");
  back("/central/manutencao", "Ocorrência aberta.");
}

export async function updateTicket(fd: FormData) {
  const u = await requireUser("manutencao");
  if (u.role === "camareira") return;
  const id = num(fd.get("id"));
  const status = str(fd.get("status"));
  const sql = db();
  if (status === "resolvida") {
    await sql`UPDATE tickets SET status = 'resolvida', resolved_at = now(), cost = ${num(fd.get("cost"))} WHERE id = ${id}`;
    const cost = num(fd.get("cost"));
    if (cost && cost > 0) {
      const [t] = await sql`SELECT unit_id, title FROM tickets WHERE id = ${id}`;
      await sql`INSERT INTO expenses (date, unit_id, category, description, amount, created_by)
        VALUES (CURRENT_DATE, ${t.unit_id}, 'Manutenção', ${"Ocorrência #" + id + ": " + t.title}, ${cost}, ${u.id})`;
    }
  } else if (status === "em_andamento" || status === "aberta") {
    await sql`UPDATE tickets SET status = ${status}, assignee = COALESCE(${str(fd.get("assignee"))}, assignee), resolved_at = NULL WHERE id = ${id}`;
  }
  revalidatePath("/central", "layout");
}

/* ——— Financeiro ——— */

export async function createExpense(fd: FormData) {
  const u = await requireUser("financeiro");
  const date = str(fd.get("date"));
  const amount = num(fd.get("amount"));
  const category = str(fd.get("category"));
  const month = str(fd.get("mes")) ?? "";
  const path = `/central/financeiro${month ? `?mes=${month}` : ""}`;
  if (!date || !amount || !category || !EXPENSE_CATEGORIES.includes(category)) back(path, "Preencha data, categoria e valor.", "erro");
  await db()`INSERT INTO expenses (date, unit_id, category, description, supplier, amount, created_by)
    VALUES (${date}, ${num(fd.get("unit_id"))}, ${category}, ${str(fd.get("description"))}, ${str(fd.get("supplier"))}, ${amount}, ${u.id})`;
  revalidatePath("/central/financeiro");
  back(path, "Custo lançado.");
}

export async function deleteExpense(fd: FormData) {
  await requireUser("financeiro");
  await db()`DELETE FROM expenses WHERE id = ${num(fd.get("id"))}`;
  revalidatePath("/central/financeiro");
}

/* ——— Unidades ——— */

export async function saveUnit(fd: FormData) {
  const me = await requireUser("unidades");
  if (me.role !== "admin") return;
  const id = num(fd.get("id"));
  const clean = (v: string | null) => (v && /^https?:\/\//.test(v) ? v : null);
  const airbnb = str(fd.get("ical_airbnb"));
  const booking = str(fd.get("ical_booking"));
  if ((airbnb && !clean(airbnb)) || (booking && !clean(booking))) {
    back(`/central/unidades/${id}`, "O link iCal precisa começar com https://", "erro");
  }
  await db()`UPDATE units SET
    apt = ${str(fd.get("apt"))}, floor = ${str(fd.get("floor"))}, area = ${num(fd.get("area"))},
    capacity = ${num(fd.get("capacity")) ?? 2},
    wifi_network = ${str(fd.get("wifi_network"))}, wifi_password = ${str(fd.get("wifi_password"))},
    lock_id = ${str(fd.get("lock_id"))},
    ical_airbnb = ${clean(airbnb)}, ical_booking = ${clean(booking)},
    condo_fee = ${num(fd.get("condo_fee")) ?? 0}, iptu = ${num(fd.get("iptu")) ?? 0}, internet = ${num(fd.get("internet")) ?? 0},
    notes = ${str(fd.get("notes"))}, active = ${fd.get("active") === "on"}
    WHERE id = ${id}`;
  revalidatePath("/central", "layout");
  back(`/central/unidades/${id}`, "Unidade salva.");
}

/* ——— Equipe ——— */

const ROLES: Role[] = ["admin", "atendimento", "governanca", "camareira"];

export async function createUserAction(fd: FormData) {
  await requireUser("equipe");
  const name = str(fd.get("name"));
  const email = str(fd.get("email"))?.toLowerCase();
  const password = str(fd.get("password"));
  const role = str(fd.get("role")) as Role;
  if (!name || !email || !password || password.length < 8 || !ROLES.includes(role)) {
    back("/central/equipe", "Preencha nome, e-mail, perfil e uma senha com pelo menos 8 caracteres.", "erro");
  }
  const sql = db();
  const [exists] = await sql`SELECT 1 FROM users WHERE lower(email) = ${email!}`;
  if (exists) back("/central/equipe", "Já existe alguém com esse e-mail.", "erro");
  await sql`INSERT INTO users (name, email, phone, password_hash, role) VALUES (${name}, ${email!}, ${str(fd.get("phone"))}, ${await hashPassword(password!)}, ${role})`;
  revalidatePath("/central/equipe");
  back("/central/equipe", `${name} já pode entrar com o e-mail ${email}.`);
}

export async function updateUserAction(fd: FormData) {
  const me = await requireUser("equipe");
  const id = num(fd.get("id"));
  const role = str(fd.get("role")) as Role;
  const active = fd.get("active") === "on";
  const password = str(fd.get("password"));
  if (id === me.id && (!active || role !== "admin")) back("/central/equipe", "Você não pode tirar o seu próprio acesso de gestor.", "erro");
  if (!ROLES.includes(role)) return;
  const sql = db();
  await sql`UPDATE users SET role = ${role}, active = ${active}, phone = ${str(fd.get("phone"))} WHERE id = ${id}`;
  if (password) {
    if (password.length < 8) back("/central/equipe", "A nova senha precisa ter pelo menos 8 caracteres.", "erro");
    await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${id}`;
  }
  revalidatePath("/central/equipe");
  back("/central/equipe", "Acesso atualizado.");
}

/* ——— Configurações ——— */

const SETTING_KEYS = ["company_name", "airbnb_fee", "booking_fee", "airbnb_url", "booking_url", "whatsapp_central", "phone_portaria", "phone_plantao", "email_contato", "checkin_time", "checkout_time", "occupancy_goal", "rating_goal", "trash_location"];

export async function saveSettings(fd: FormData) {
  await requireUser("configuracoes");
  const sql = db();
  for (const k of SETTING_KEYS) {
    let v = String(fd.get(k) ?? "").trim();
    if (["airbnb_fee", "booking_fee", "occupancy_goal"].includes(k)) {
      const n = num(v);
      v = n === null ? "0" : String(n > 1 ? n / 100 : n);
    }
    if (k === "rating_goal") v = String(num(v) ?? 4.8);
    await sql`INSERT INTO settings (key, value) VALUES (${k}, ${v}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  revalidatePath("/", "layout");
  back("/central/configuracoes", "Configurações salvas.");
}

/* ——— Contatos do site ——— */

export async function setLeadStatus(fd: FormData) {
  await requireUser("contatos");
  const status = str(fd.get("status"));
  if (!["novo", "respondido", "fechado", "perdido"].includes(status ?? "")) return;
  await db()`UPDATE leads SET status = ${status} WHERE id = ${num(fd.get("id"))}`;
  revalidatePath("/central", "layout");
}
