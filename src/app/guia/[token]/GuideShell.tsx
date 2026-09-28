"use client";

import { useEffect, useState } from "react";

/** Troca PT/EN no guia e copia a senha do Wi-Fi. */
export function GuideShell({ wifiPassword, children }: { wifiPassword: string | null; children: React.ReactNode }) {
  const [lang, setLang] = useState<"pt" | "en">("pt");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("artem-lang");
    } catch {}
    if (saved === "pt" || saved === "en") setLang(saved);
    else if (!(navigator.language || "").toLowerCase().startsWith("pt")) setLang("en");
  }, []);

  const pick = (l: "pt" | "en") => {
    setLang(l);
    try {
      localStorage.setItem("artem-lang", l);
    } catch {}
  };

  const copy = async () => {
    if (!wifiPassword) return;
    try {
      await navigator.clipboard.writeText(wifiPassword);
      setToast(lang === "en" ? "Password copied" : "Senha copiada");
    } catch {
      setToast(wifiPassword);
    }
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="g" data-lang={lang} lang={lang === "en" ? "en" : "pt-BR"}>
      <div className="bar">
        <div className="bar-in">
          <div className="mark"><b>RGR</b> · Artem</div>
          <div className="lang" role="group" aria-label="Idioma / Language">
            <button type="button" aria-pressed={lang === "pt"} onClick={() => pick("pt")}>PT</button>
            <button type="button" aria-pressed={lang === "en"} onClick={() => pick("en")}>EN</button>
          </div>
        </div>
        <nav className="chips" aria-label="Seções">
          <a href="#chegada"><span lang="pt">Chegada</span><span lang="en">Arrival</span></a>
          <a href="#apartamento"><span lang="pt">Apartamento</span><span lang="en">Apartment</span></a>
          <a href="#regras"><span lang="pt">Regras</span><span lang="en">House rules</span></a>
          <a href="#bairro"><span lang="pt">Bairro</span><span lang="en">Neighborhood</span></a>
          <a href="#saida"><span lang="pt">Saída</span><span lang="en">Check-out</span></a>
          <a href="#contato"><span lang="pt">Contato</span><span lang="en">Contact</span></a>
        </nav>
      </div>
      <div onClick={(e) => ((e.target as HTMLElement).closest("[data-copy-wifi]") ? copy() : undefined)}>{children}</div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
