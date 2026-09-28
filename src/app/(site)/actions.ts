"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { ensureDatabase } from "@/lib/schema";
import { num, str } from "@/lib/util";

const hits = new Map<string, number[]>();

export async function createLead(fd: FormData) {
  // campo invisível: robôs preenchem, pessoas não
  if (str(fd.get("empresa"))) redirect("/?enviado=1#reservar");

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 5) redirect("/?erro=limite#reservar");
  hits.set(ip, [...recent, now]);

  const name = str(fd.get("name"));
  const email = str(fd.get("email"));
  const phone = str(fd.get("phone"));
  if (!name || (!email && !phone)) redirect("/?erro=dados#reservar");

  const check_in = str(fd.get("check_in"));
  const check_out = str(fd.get("check_out"));
  const valid = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

  await ensureDatabase();
  await db()`
    INSERT INTO leads (name, email, phone, check_in, check_out, guests, reason, message)
    VALUES (${name.slice(0, 120)}, ${email?.slice(0, 160) ?? null}, ${phone?.slice(0, 40) ?? null},
      ${valid(check_in)}, ${valid(check_out)}, ${num(fd.get("guests"))},
      ${str(fd.get("reason"))?.slice(0, 40) ?? null}, ${str(fd.get("message"))?.slice(0, 2000) ?? null})`;
  redirect("/?enviado=1#reservar");
}
