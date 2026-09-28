import { db } from "./db";

export const TZ = "America/Sao_Paulo";

/** Data de hoje em São Paulo, no formato YYYY-MM-DD. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
}

export function monthStart(iso: string) {
  return iso.slice(0, 7) + "-01";
}

export function monthEnd(iso: string) {
  const d = new Date(monthStart(iso) + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function shiftMonth(iso: string, n: number) {
  const d = new Date(monthStart(iso) + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function monthLabel(iso: string) {
  const m = MONTHS[Number(iso.slice(5, 7)) - 1];
  return `${m[0].toUpperCase()}${m.slice(1)} de ${iso.slice(0, 4)}`;
}

export function weekday(iso: string) {
  return WEEK[new Date(iso + "T12:00:00Z").getUTCDay()];
}

export function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function fmtShort(iso?: string | null) {
  if (!iso) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function fmtDateTime(d?: Date | string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function money(v: unknown) {
  const n = Number(v ?? 0);
  return brl.format(Number.isFinite(n) ? n : 0);
}

export function pct(v: number) {
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

export function num(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function str(v: FormDataEntryValue | null): string | null {
  const s = v === null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db()`SELECT key, value FROM settings`;
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export const CHANNEL_LABEL: Record<string, string> = { airbnb: "Airbnb", booking: "Booking", direto: "Direto" };

export const PRIORITY: Record<string, { label: string; hours: number }> = {
  p1: { label: "P1 · Urgente", hours: 2 },
  p2: { label: "P2 · Alta", hours: 12 },
  p3: { label: "P3 · Normal", hours: 48 },
  preventiva: { label: "Preventiva", hours: 168 },
};

export const CLEANING_TYPE: Record<string, string> = {
  saida: "Saída",
  saida_entrada: "Saída + entrada",
  meio_estadia: "Meio de estadia",
  profunda: "Profunda",
};

export const CLEANING_STATUS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  pronta: "Pronta",
  vistoriada: "Vistoriada",
  cancelada: "Cancelada",
};

export const EXPENSE_CATEGORIES = ["Limpeza", "Lavanderia", "Amenities", "Manutenção", "Condomínio", "IPTU", "Energia", "Internet", "Software", "Pessoal", "Marketing", "Impostos", "Outros"];
