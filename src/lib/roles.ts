export type Role = "admin" | "atendimento" | "governanca" | "camareira";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Gestor",
  atendimento: "Atendimento",
  governanca: "Governança",
  camareira: "Camareira",
};

export type ModuleKey =
  | "painel"
  | "calendario"
  | "reservas"
  | "portaria"
  | "limpeza"
  | "manutencao"
  | "financeiro"
  | "contatos"
  | "unidades"
  | "equipe"
  | "configuracoes";

export const MODULES: { key: ModuleKey; label: string; href: string; roles: Role[]; group: string }[] = [
  { key: "painel", label: "Painel", href: "/central", roles: ["admin", "atendimento", "governanca"], group: "Hoje" },
  { key: "calendario", label: "Calendário", href: "/central/calendario", roles: ["admin", "atendimento", "governanca"], group: "Hoje" },
  { key: "limpeza", label: "Limpeza", href: "/central/limpeza", roles: ["admin", "atendimento", "governanca", "camareira"], group: "Hoje" },
  { key: "manutencao", label: "Manutenção", href: "/central/manutencao", roles: ["admin", "atendimento", "governanca", "camareira"], group: "Hoje" },
  { key: "reservas", label: "Reservas", href: "/central/reservas", roles: ["admin", "atendimento"], group: "Hóspedes" },
  { key: "portaria", label: "Portaria", href: "/central/portaria", roles: ["admin", "atendimento", "governanca"], group: "Hóspedes" },
  { key: "contatos", label: "Contatos do site", href: "/central/contatos", roles: ["admin", "atendimento"], group: "Hóspedes" },
  { key: "financeiro", label: "Financeiro", href: "/central/financeiro", roles: ["admin"], group: "Gestão" },
  { key: "unidades", label: "Unidades", href: "/central/unidades", roles: ["admin", "governanca"], group: "Gestão" },
  { key: "equipe", label: "Equipe", href: "/central/equipe", roles: ["admin"], group: "Gestão" },
  { key: "configuracoes", label: "Configurações", href: "/central/configuracoes", roles: ["admin"], group: "Gestão" },
];

export function can(role: Role, key: ModuleKey) {
  return MODULES.find((m) => m.key === key)!.roles.includes(role);
}

export function homeFor(role: Role) {
  return role === "camareira" ? "/central/limpeza" : "/central";
}
