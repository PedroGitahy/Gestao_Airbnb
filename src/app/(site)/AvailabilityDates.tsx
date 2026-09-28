"use client";

import { useEffect, useState } from "react";

/** Datas do pedido de reserva com a consulta de studios livres. */
export function AvailabilityDates() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [min, setMin] = useState("");

  useEffect(() => {
    setMin(new Date().toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (!a || !b) {
      setMsg(null);
      return;
    }
    if (b <= a) {
      setMsg({ tone: "err", text: "A saída precisa ser depois da entrada." });
      return;
    }
    const ctrl = new AbortController();
    setMsg({ tone: "info", text: "Consultando disponibilidade…" });
    fetch(`/api/disponibilidade?entrada=${a}&saida=${b}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.livres !== "number") return setMsg(null);
        const nights = d.noites === 1 ? "1 noite" : `${d.noites} noites`;
        if (d.livres === 0) setMsg({ tone: "err", text: `Sem studios livres para essas ${nights}. Envie mesmo assim: avisamos se abrir uma vaga.` });
        else setMsg({ tone: "ok", text: `${d.livres} ${d.livres === 1 ? "studio livre" : "studios livres"} para ${nights}.` });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [a, b]);

  return (
    <>
      <div className="grid-3">
        <div className="field"><label htmlFor="l-in">Entrada</label><input id="l-in" name="check_in" type="date" min={min} value={a} onChange={(e) => setA(e.target.value)} /></div>
        <div className="field"><label htmlFor="l-out">Saída</label><input id="l-out" name="check_out" type="date" min={a || min} value={b} onChange={(e) => setB(e.target.value)} /></div>
        <div className="field"><label htmlFor="l-guests">Pessoas</label><input id="l-guests" name="guests" inputMode="numeric" /></div>
      </div>
      {msg && (
        <div className={msg.tone === "info" ? "muted" : `flash ${msg.tone}`} role="status" style={msg.tone === "info" ? { fontSize: 14 } : { margin: 0 }}>
          {msg.text}
        </div>
      )}
    </>
  );
}
