import Link from "next/link";

export default function HomePage() {
  return (
    <section className="elite-hero fade-in rounded-3xl p-6 md:p-10">
      <div className="relative z-10 max-w-3xl space-y-4">
        <p className="elite-label">AI Sports Analytics MVP</p>
        <h1 className="font-[var(--font-display)] text-3xl font-semibold leading-tight text-[#f3f7ff] md:text-5xl">
          Jogos reais do dia com predições EV em tempo real
        </h1>
        <p className="text-sm text-[#d7e2f4] md:text-base">
          Plataforma enxuta focada no essencial: sincronizar jogos reais (futebol e basquete), mostrar partidas do dia e abrir análise detalhada por jogo.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/dashboard" className="elite-btn elite-btn-primary">Abrir dashboard</Link>
          <Link href="/predictions" className="elite-btn elite-btn-secondary">Ver predições</Link>
        </div>
      </div>
    </section>
  );
}
