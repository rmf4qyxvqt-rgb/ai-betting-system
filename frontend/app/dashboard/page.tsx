"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, DashboardSummary, Game, Prediction, TopOpportunity } from "@/services/api";
import { PredictionTable } from "@/components/PredictionTable";
import { StatCard } from "@/components/StatCard";

function decisionLabel(tier: string, score: number) {
  if (score < 50 || tier === "evitar") return "NAO APOSTAR";
  if (tier === "entrada_principal") return "APOSTAR AGORA";
  if (tier === "entrada_moderada") return "APOSTAR COM CAUTELA";
  return "APOSTAR COM PROTECAO";
}

function decisionClass(tier: string, score: number) {
  const decision = decisionLabel(tier, score);
  if (decision === "APOSTAR AGORA") return "desk-chip desk-chip-green";
  if (decision === "APOSTAR COM CAUTELA") return "desk-chip desk-chip-amber";
  if (decision === "APOSTAR COM PROTECAO") return "desk-chip desk-chip-blue";
  return "desk-chip desk-chip-red";
}

function leagueBySport(sport: string) {
  if (sport === "basketball") return "NBA";
  if (sport === "football") return "Futebol";
  return "Outros";
}

function familyLabel(family: string) {
  const labels: Record<string, string> = {
    jogo_inteiro: "Jogo inteiro",
    primeiro_quarto: "1 quarto",
    primeiro_tempo: "1 tempo",
    segundo_tempo: "2 tempo",
    terceiro_quarto: "3 quarto",
    ao_vivo: "Ao vivo",
  };
  return labels[family] ?? family.replaceAll("_", " ");
}

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [topOpportunities, setTopOpportunities] = useState<TopOpportunity[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  const [liveOnly, setLiveOnly] = useState(false);
  const [bet365Mode, setBet365Mode] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [gamesData, predsData, topData, summaryData] = await Promise.all([
          api.getTodayGames(),
          api.getPredictions(true),
          api.getTopOpportunities(8),
          api.getDashboardSummary(),
        ]);
        setGames(gamesData);
        setPredictions(predsData);
        setTopOpportunities(topData);
        setSummary(summaryData);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const topPrediction = useMemo(() => predictions[0] ?? null, [predictions]);

  const liveMatchIds = useMemo(() => {
    return new Set(
      predictions
        .filter((item) => {
          const analysis = item.analise_avancada as { ao_vivo?: { is_live?: boolean } } | undefined;
          return Boolean(analysis?.ao_vivo?.is_live);
        })
        .map((item) => item.match_id)
    );
  }, [predictions]);

  const filteredPredictions = useMemo(() => {
    return predictions.filter((item) => {
      const analysis = item.analise_avancada as { ao_vivo?: { is_live?: boolean } } | undefined;
      if (liveOnly && !analysis?.ao_vivo?.is_live) return false;
      if (leagueFilter !== "all" && leagueBySport(item.sport) !== leagueFilter) return false;

      if (timeFilter !== "all") {
        const game = games.find((candidate) => candidate.id === item.match_id);
        if (!game) return false;
        const hour = new Date(game.date).getHours();
        if (timeFilter === "morning" && !(hour >= 6 && hour < 12)) return false;
        if (timeFilter === "afternoon" && !(hour >= 12 && hour < 18)) return false;
        if (timeFilter === "night" && !(hour >= 18 && hour < 24)) return false;
        if (timeFilter === "dawn" && !(hour >= 0 && hour < 6)) return false;
      }

      return true;
    });
  }, [predictions, liveOnly, leagueFilter, timeFilter, games]);

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      if (leagueFilter !== "all" && leagueBySport(g.sport) !== leagueFilter) return false;
      if (liveOnly && !liveMatchIds.has(g.id)) return false;

      if (timeFilter !== "all") {
        const hour = new Date(g.date).getHours();
        if (timeFilter === "morning" && !(hour >= 6 && hour < 12)) return false;
        if (timeFilter === "afternoon" && !(hour >= 12 && hour < 18)) return false;
        if (timeFilter === "night" && !(hour >= 18 && hour < 24)) return false;
        if (timeFilter === "dawn" && !(hour >= 0 && hour < 6)) return false;
      }

      return true;
    });
  }, [games, leagueFilter, liveOnly, liveMatchIds, timeFilter]);

  const filteredTop = useMemo(() => {
    return topOpportunities.filter((item) => {
      if (liveOnly && !item.is_live) return false;
      if (leagueFilter !== "all" && leagueBySport(item.sport) !== leagueFilter) return false;
      return true;
    });
  }, [topOpportunities, liveOnly, leagueFilter]);

  const liveTop = filteredTop.filter((item) => item.is_live);
  const preGameTop = filteredTop.filter((item) => !item.is_live);

  const marketBreakdown = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.mercados)
      .sort((a, b) => b[1].executar - a[1].executar)
      .map(([family, stats]) => ({ family, ...stats }));
  }, [summary]);

  return (
    <div className="space-y-6">
      <section className="desk-hero rounded-[32px] p-6 md:p-8">
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="desk-kicker">Operation Desk</p>
            <h1 className="mt-3 max-w-3xl font-[var(--font-display)] text-4xl font-semibold leading-tight text-white md:text-5xl">
              Painel profissional para operar linhas no padrão Bet365 com leitura direta de valor.
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-[#d5e0f0] md:text-base">
              O sistema cruza a linha da IA com a referência de casa, destaca edge operacional e simplifica a decisão para execução rápida.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/predictions" className="elite-btn elite-btn-primary">Abrir mesa de mercados</Link>
              <button type="button" onClick={() => setBet365Mode((value) => !value)} className="elite-btn elite-btn-secondary">
                {bet365Mode ? "Modo Bet365 ativo" : "Ativar modo Bet365"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="desk-metric">
              <p className="desk-metric-label">Melhor mercado</p>
              <p className="mt-3 font-[var(--font-display)] text-3xl font-semibold text-white">{filteredTop[0]?.market_label ?? "Sem sinal"}</p>
              <p className="mt-2 text-sm text-[#d2deee]">{filteredTop[0]?.reason ?? "Sem oportunidade principal ainda."}</p>
            </div>
            <div className="desk-metric">
              <p className="desk-metric-label">Edge médio</p>
              <p className="mt-3 font-[var(--font-display)] text-3xl font-semibold text-white">{summary ? `${summary.edge_medio.toFixed(1)} pts` : "0.0 pts"}</p>
              <p className="mt-2 text-sm text-[#d2deee]">Diferença média entre linha da IA e linha esperada da casa.</p>
            </div>
            <div className="desk-metric">
              <p className="desk-metric-label">Entradas fortes</p>
              <p className="mt-3 font-[var(--font-display)] text-3xl font-semibold text-white">{summary?.fortes ?? 0}</p>
              <p className="mt-2 text-sm text-[#d2deee]">Mercados com score operacional realmente forte.</p>
            </div>
            <div className="desk-metric">
              <p className="desk-metric-label">Ao vivo</p>
              <p className="mt-3 font-[var(--font-display)] text-3xl font-semibold text-white">{summary?.ao_vivo ?? 0}</p>
              <p className="mt-2 text-sm text-[#d2deee]">Sinais em tempo real monitorados neste momento.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Jogos do dia" value={String(filteredGames.length)} hint="Agenda operacional filtrada" />
        <StatCard title="Mercados EV+" value={String(filteredPredictions.length)} hint="Oportunidades com valor positivo" />
        <StatCard title="Modo de linha" value={bet365Mode ? "Bet365" : "IA pura"} hint="Comparação de referência ativa" />
        <StatCard title="Entrada principal" value={topPrediction ? `${(topPrediction.ev * 100).toFixed(1)}%` : "0.0%"} hint="Valor esperado do melhor sinal" />
      </section>

      <section className="desk-card rounded-[28px] p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="desk-kicker text-[#55739d]">Filtros</p>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">Mesa operacional</h2>
            <p className="mt-1 text-sm text-slate">Filtre a agenda para deixar só o que realmente merece sua atenção.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)} className="rounded-2xl border border-mist bg-white px-4 py-3 text-sm text-ink">
              <option value="all">Liga: Todas</option>
              <option value="NBA">Liga: NBA</option>
              <option value="Futebol">Liga: Futebol</option>
            </select>
            <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="rounded-2xl border border-mist bg-white px-4 py-3 text-sm text-ink">
              <option value="all">Horario: Todos</option>
              <option value="morning">Manhã</option>
              <option value="afternoon">Tarde</option>
              <option value="night">Noite</option>
              <option value="dawn">Madrugada</option>
            </select>
            <label className="inline-flex items-center gap-3 rounded-2xl border border-mist bg-white px-4 py-3 text-sm font-medium text-ink">
              <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} className="h-4 w-4 accent-cyan" />
              Somente ao vivo
            </label>
            <div className="rounded-2xl border border-mist bg-[#f8fafc] px-4 py-3 text-sm text-slate">
              <span className="font-semibold text-ink">Modo:</span> {bet365Mode ? "Comparador IA x Bet365" : "Leitura pura da IA"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="desk-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="desk-kicker text-[#55739d]">Top oportunidades</p>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">Cartela principal do dia</h2>
            </div>
            <span className="desk-chip desk-chip-gold">Modo Bet365</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredTop.slice(0, 4).map((item) => (
              <div key={`${item.match_id}:${item.market}`} className="desk-card-dark rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="desk-kicker text-[#89a6cf]">{item.is_live ? "Ao vivo" : "Pré-jogo"}</p>
                    <h3 className="mt-2 font-[var(--font-display)] text-2xl font-semibold text-white">{item.market_label}</h3>
                    <p className="mt-2 text-sm text-[#c6d4e7]">{item.home_team} x {item.away_team}</p>
                  </div>
                  <span className={decisionClass(item.tier, item.score_entrada)}>{decisionLabel(item.tier, item.score_entrada)}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ea9cf]">Linha IA</p>
                    <p className="mt-2 text-xl font-semibold text-white">{item.ai_line ?? "n/d"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ea9cf]">Linha casa</p>
                    <p className="mt-2 text-xl font-semibold text-white">{item.house_line ?? "n/d"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ea9cf]">Edge</p>
                    <p className="mt-2 text-xl font-semibold text-white">{typeof item.line_edge === "number" ? item.line_edge.toFixed(1) : "n/d"}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-[#d8e3f1]">{item.reason ?? "Sem motivo resumido."}</p>
                <div className="mt-4 flex items-center justify-between text-sm text-[#d0dcec]">
                  <span>Stake {item.stake}</span>
                  <Link href={`/games/${item.match_id}`} className="rounded-full border border-white/20 px-3 py-1.5 font-semibold text-white transition hover:border-[#d3ab67] hover:text-[#f5d69d]">Abrir análise</Link>
                </div>
              </div>
            ))}
            {!loading && filteredTop.length === 0 ? <div className="rounded-2xl border border-dashed border-mist p-6 text-sm text-slate">Sem oportunidades com os filtros atuais.</div> : null}
          </div>
        </article>

        <article className="desk-card rounded-[28px] p-5 md:p-6">
          <p className="desk-kicker text-[#55739d]">Resumo por mercado</p>
          <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">Onde a operação está mais limpa</h2>
          <div className="mt-4 space-y-3">
            {marketBreakdown.map((row) => (
              <div key={row.family} className="rounded-2xl border border-mist bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink">{familyLabel(row.family)}</p>
                  <span className="desk-chip desk-chip-blue">{row.executar} executar</span>
                </div>
                <p className="mt-2 text-sm text-slate">{row.positivos} EV+ em {row.total} mercados monitorados.</p>
              </div>
            ))}
            {marketBreakdown.length === 0 ? <p className="text-sm text-slate">Resumo ainda indisponível.</p> : null}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="desk-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="desk-kicker text-[#55739d]">Pré-jogo</p>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">Agenda para montar entrada</h2>
            </div>
            <span className="desk-chip desk-chip-blue">{preGameTop.length} sinais</span>
          </div>
          <div className="space-y-3">
            {preGameTop.slice(0, 4).map((item) => (
              <div key={`${item.match_id}:pre`} className="rounded-2xl border border-mist bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{item.home_team} x {item.away_team}</p>
                    <p className="mt-1 text-sm text-slate">{item.market_label}</p>
                  </div>
                  <span className={decisionClass(item.tier, item.score_entrada)}>{decisionLabel(item.tier, item.score_entrada)}</span>
                </div>
                <p className="mt-2 text-sm text-slate">{item.reason}</p>
              </div>
            ))}
            {!loading && preGameTop.length === 0 ? <p className="text-sm text-slate">Sem entradas pré-jogo nos filtros atuais.</p> : null}
          </div>
        </article>

        <article className="desk-card rounded-[28px] p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="desk-kicker text-[#55739d]">Ao vivo</p>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">Radar de execução imediata</h2>
            </div>
            <span className="desk-chip desk-chip-gold">{liveTop.length} sinais</span>
          </div>
          <div className="space-y-3">
            {liveTop.slice(0, 4).map((item) => (
              <div key={`${item.match_id}:live`} className="rounded-2xl border border-mist bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{item.home_team} x {item.away_team}</p>
                    <p className="mt-1 text-sm text-slate">{item.market_label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7e97ba]">{item.live_status}</p>
                  </div>
                  <span className={decisionClass(item.tier, item.score_entrada)}>{decisionLabel(item.tier, item.score_entrada)}</span>
                </div>
                <p className="mt-2 text-sm text-slate">{item.reason}</p>
              </div>
            ))}
            {!loading && liveTop.length === 0 ? <p className="text-sm text-slate">Sem oportunidade ao vivo agora.</p> : null}
          </div>
        </article>
      </section>

      <section className="desk-card rounded-[28px] p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="desk-kicker text-[#55739d]">Agenda</p>
            <h2 className="font-[var(--font-display)] text-2xl font-semibold text-ink">Jogos filtrados do dia</h2>
          </div>
          <span className="desk-chip desk-chip-blue">{filteredGames.length} jogos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="desk-table min-w-full text-sm">
            <thead className="text-slate">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Jogo</th>
                <th className="px-4 py-3 text-left font-semibold">Liga</th>
                <th className="px-4 py-3 text-left font-semibold">Horario</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredGames.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 font-medium text-ink">{g.home_team} x {g.away_team}</td>
                  <td className="px-4 py-3 text-slate">{leagueBySport(g.sport)}</td>
                  <td className="px-4 py-3 text-slate">{new Date(g.date).toLocaleString()}</td>
                  <td className="px-4 py-3">{liveMatchIds.has(g.id) ? <span className="desk-chip desk-chip-gold">Ao vivo</span> : <span className="desk-chip desk-chip-blue">Programado</span>}</td>
                  <td className="px-4 py-3"><Link href={`/games/${g.id}`} className="rounded-full border border-mist bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-[#b99050] hover:text-[#7a5419]">Abrir análise</Link></td>
                </tr>
              ))}
              {!loading && filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-center text-slate">Nenhum jogo encontrado para os filtros escolhidos.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <PredictionTable predictions={filteredPredictions} />
    </div>
  );
}
