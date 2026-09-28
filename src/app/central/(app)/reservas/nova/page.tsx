import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Flash } from "@/components/ui";
import { ReservationForm } from "@/components/ReservationForm";

export default async function NovaReserva({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; unidade?: string; data?: string }> }) {
  await requireUser("reservas");
  const sp = await searchParams;
  const units = await db()`SELECT id, code FROM units WHERE active ORDER BY code`;
  return (
    <div style={{ maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <h1>Nova reserva</h1>
          <p>Use para reservas diretas, estadias longas ou para bloquear datas de manutenção.</p>
        </div>
        <Link className="btn" href="/central/reservas">Voltar</Link>
      </div>
      <Flash sp={sp} />
      <div className="panel panel-body">
        <ReservationForm units={units as never} r={null} defaults={{ unit_id: Number(sp.unidade) || undefined, check_in: sp.data }} />
      </div>
    </div>
  );
}
