import Link from "next/link";
import "../central/central.css";
import "./site.css";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <header className="s-nav">
        <div className="wrap">
          <Link href="/" className="s-brand"><b>RGR</b><span>Artem</span></Link>
          <nav className="s-links" aria-label="Seções">
            <a href="#predio">O prédio</a>
            <a href="#bairro">O bairro</a>
            <a href="#reservar">Reservar</a>
            <a href="#reservar" className="btn btn-primary btn-small">Ver datas</a>
          </nav>
        </div>
      </header>
      {children}
      <footer className="s-foot">
        <div className="wrap">
          <span>RGR · Studios no Artem, Rua Antônio Alves Barril, 177 · Jardim Anália Franco · São Paulo</span>
          <Link href="/central">Área da equipe</Link>
        </div>
      </footer>
    </div>
  );
}
