import { saveReservation } from "@/app/central/actions";

type Unit = { id: number; code: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Res = Record<string, any> | null;

export function ReservationForm({ units, r, defaults }: { units: Unit[]; r: Res; defaults?: { unit_id?: number; check_in?: string } }) {
  const ical = r?.source === "ical";
  const fee = r?.platform_fee_pct != null ? String(Math.round(Number(r.platform_fee_pct) * 1000) / 10).replace(".", ",") : "";
  return (
    <form action={saveReservation} className="form">
      {r && <input type="hidden" name="id" value={r.id} />}
      {ical && (
        <>
          {/* datas e canal vêm do calendário da plataforma */}
          <input type="hidden" name="unit_id" value={r!.unit_id} />
          <input type="hidden" name="channel" value={r!.channel} />
          <input type="hidden" name="kind" value={r!.kind} />
          <input type="hidden" name="check_in" value={r!.check_in} />
          <input type="hidden" name="check_out" value={r!.check_out} />
          <input type="hidden" name="status" value={r!.status} />
        </>
      )}
      {!ical && (
        <div className="grid-4">
          <div className="field">
            <label htmlFor="unit_id">Unidade</label>
            <select id="unit_id" name="unit_id" defaultValue={r?.unit_id ?? defaults?.unit_id ?? ""} required>
              <option value="" disabled>Escolha</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.code}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="channel">Canal</label>
            <select id="channel" name="channel" defaultValue={r?.channel ?? "direto"}>
              <option value="direto">Direto</option>
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="check_in">Entrada</label>
            <input id="check_in" name="check_in" type="date" defaultValue={r?.check_in ?? defaults?.check_in ?? ""} required />
          </div>
          <div className="field">
            <label htmlFor="check_out">Saída</label>
            <input id="check_out" name="check_out" type="date" defaultValue={r?.check_out ?? ""} required />
          </div>
        </div>
      )}

      <div className="grid-3">
        <div className="field">
          <label htmlFor="guest_name">Hóspede</label>
          <input id="guest_name" name="guest_name" defaultValue={r?.guest_name ?? ""} placeholder="Nome completo" />
        </div>
        <div className="field">
          <label htmlFor="guest_phone">WhatsApp</label>
          <input id="guest_phone" name="guest_phone" defaultValue={r?.guest_phone ?? ""} placeholder="+55 11 9…" />
        </div>
        <div className="field">
          <label htmlFor="guest_email">E-mail</label>
          <input id="guest_email" name="guest_email" type="email" defaultValue={r?.guest_email ?? ""} />
        </div>
      </div>

      <div className="grid-4">
        <div className="field">
          <label htmlFor="guests_count">Pessoas</label>
          <input id="guests_count" name="guests_count" inputMode="numeric" defaultValue={r?.guests_count ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="gross">Valor da estadia (R$)</label>
          <input id="gross" name="gross" inputMode="decimal" defaultValue={r?.gross != null ? String(r.gross).replace(".", ",") : ""} placeholder="0,00" />
          <small>Total pago pelo hóspede, sem taxa de limpeza</small>
        </div>
        <div className="field">
          <label htmlFor="platform_fee_pct">Taxa da plataforma (%)</label>
          <input id="platform_fee_pct" name="platform_fee_pct" inputMode="decimal" defaultValue={fee} placeholder="padrão do canal" />
        </div>
        <div className="field">
          <label htmlFor="cleaning_fee">Custo da limpeza (R$)</label>
          <input id="cleaning_fee" name="cleaning_fee" inputMode="decimal" defaultValue={r?.cleaning_fee != null ? String(r.cleaning_fee).replace(".", ",") : ""} />
        </div>
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {!ical && (
          <div className="field">
            <label htmlFor="kind">Tipo</label>
            <select id="kind" name="kind" defaultValue={r?.kind ?? "reserva"}>
              <option value="reserva">Reserva</option>
              <option value="bloqueio">Bloqueio de datas</option>
            </select>
          </div>
        )}
        {!ical && (
          <div className="field">
            <label htmlFor="status">Situação</label>
            <select id="status" name="status" defaultValue={r?.status ?? "confirmada"}>
              <option value="confirmada">Confirmada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="door_code">Senha da porta</label>
          <input id="door_code" name="door_code" defaultValue={r?.door_code ?? ""} placeholder="Gerada no app da fechadura" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="confirmation_code">Código da reserva</label>
          <input id="confirmation_code" name="confirmation_code" defaultValue={r?.confirmation_code ?? ""} placeholder="Ex.: HMXXXXXXXX" />
        </div>
        <div className="field">
          <label htmlFor="rating">Nota da avaliação</label>
          <input id="rating" name="rating" inputMode="decimal" defaultValue={r?.rating != null ? String(r.rating).replace(".", ",") : ""} placeholder="1 a 5" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="notes">Observações</label>
        <textarea id="notes" name="notes" defaultValue={r?.notes ?? ""} placeholder="Horário de chegada, pedidos especiais, ocorrências" />
      </div>
      <div className="actions">
        <button className="btn btn-primary" type="submit">Salvar reserva</button>
      </div>
    </form>
  );
}
