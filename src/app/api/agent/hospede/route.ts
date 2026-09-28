import { NextResponse, type NextRequest } from "next/server";
import { agentGuard } from "@/lib/agent";
import { db } from "@/lib/db";
import { addDays, getSettings, today } from "@/lib/util";

export const dynamic = "force-dynamic";

/**
 * Encontra a estadia atual ou próxima de um hóspede pelo telefone (últimos 8 dígitos)
 * e devolve o que o agente precisa para responder: unidade, datas, Wi-Fi e guia.
 */
export async function GET(req: NextRequest) {
  const deny = await agentGuard(req);
  if (deny) return deny;
  const digits = (req.nextUrl.searchParams.get("telefone") ?? "").replace(/\D/g, "").slice(-8);
  if (digits.length < 8) return NextResponse.json({ erro: "informe ?telefone= com DDD" }, { status: 400 });
  const d = today();
  const [r] = await db()`
    SELECT r.id, r.guest_name, r.check_in, r.check_out, r.guests_count, u.code, u.apt, u.floor, u.wifi_network, u.wifi_password, u.guide_token
    FROM reservations r JOIN units u ON u.id = r.unit_id
    WHERE r.status = 'confirmada' AND r.kind = 'reserva'
      AND right(regexp_replace(coalesce(r.guest_phone, ''), '\\D', '', 'g'), 8) = ${digits}
      AND r.check_out >= ${d}::date AND r.check_in <= ${addDays(d, 30)}::date
    ORDER BY r.check_in LIMIT 1`;
  if (!r) return NextResponse.json({ encontrado: false });
  const s = await getSettings();
  const hospedado = r.check_in <= d && r.check_out > d;
  return NextResponse.json({
    encontrado: true,
    reserva: r.id,
    hospede: r.guest_name,
    unidade: r.code,
    apartamento: r.apt,
    andar: r.floor,
    entrada: r.check_in,
    saida: r.check_out,
    hospedado_agora: hospedado,
    // o Wi-Fi só é informado a partir da véspera da entrada
    wifi: r.check_in <= addDays(d, 1) ? { rede: r.wifi_network, senha: r.wifi_password } : null,
    guia: `${process.env.SITE_URL ?? ""}/guia/${r.guide_token}`,
    check_in: s.checkin_time,
    check_out: s.checkout_time,
    contato_central: s.whatsapp_central,
  });
}
