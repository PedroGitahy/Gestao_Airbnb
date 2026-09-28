export function Flash({ sp }: { sp: { ok?: string; erro?: string } }) {
  if (sp.erro) return <div className="flash err" role="alert">{sp.erro}</div>;
  if (sp.ok) return <div className="flash ok" role="status">{sp.ok}</div>;
  return null;
}

export function UnitCode({ code }: { code: string }) {
  return <span className="unit-code">{code}</span>;
}

export function Channel({ channel, kind }: { channel: string; kind?: string }) {
  if (kind === "bloqueio") return <span className="ch bloqueio">Bloqueio</span>;
  const label: Record<string, string> = { airbnb: "Airbnb", booking: "Booking", direto: "Direto" };
  return <span className={`ch ${channel}`}>{label[channel] ?? channel}</span>;
}

const CLEAN_TONE: Record<string, string> = { pendente: "warn", em_andamento: "info", pronta: "moss", vistoriada: "good", cancelada: "" };
const CLEAN_LABEL: Record<string, string> = { pendente: "Pendente", em_andamento: "Em andamento", pronta: "Pronta", vistoriada: "Vistoriada", cancelada: "Cancelada" };
export function CleaningPill({ status }: { status: string }) {
  return <span className={`pill ${CLEAN_TONE[status] ?? ""}`}>{CLEAN_LABEL[status] ?? status}</span>;
}

export function TicketPill({ status, overdue }: { status: string; overdue?: boolean }) {
  if (status === "resolvida") return <span className="pill good">Resolvida</span>;
  if (overdue) return <span className="pill bad">Atrasada</span>;
  return <span className={`pill ${status === "em_andamento" ? "info" : "warn"}`}>{status === "em_andamento" ? "Em andamento" : "Aberta"}</span>;
}

export function PriorityPill({ p }: { p: string }) {
  const map: Record<string, [string, string]> = { p1: ["bad", "P1 · Urgente"], p2: ["warn", "P2 · Alta"], p3: ["", "P3 · Normal"], preventiva: ["moss", "Preventiva"] };
  const [tone, label] = map[p] ?? ["", p];
  return <span className={`pill ${tone}`}>{label}</span>;
}
