"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api, Game, Prediction } from "@/services/api";

type AdvancedAnalysis = {
  integridade?: {
    risco_manipulacao?: string;
    score_risco?: number;
    alerta?: string;
  };
  recomendacao?: {
    confianca?: string;
    sugestao_stake?: string;
    resumo?: string;
    score_entrada?: number;
    tier?: string;
    invalidation_rule?: string;
  };
  checklist_pre_entrada?: {
    items?: Record<string, boolean>;
    aprovado?: boolean;
  };
  sport_detail?: Record<string, number | string>;
  governanca?: {
    motivo?: string;
    risco?: string;
    stake?: string;
    condicao_invalida?: string;
  };
  comparativo_casa?: {
    linha_ia?: number | null;
    linha_casa?: number | null;
    edge_linha?: number | null;
    edge_classificacao?: string;
    mercado_familia?: string;
  };
  operacao?: {
    motivo_curto?: string;
    janela?: string;
    sinal?: string;
  };
  mercado?: {
    label?: string;
    line?: number | null;
    is_live_market?: boolean;
    rationale?: string;
  };
  ao_vivo?: {
    is_live?: boolean;
    status_text?: string;
    period?: number;
    clock?: string;
    home_score?: number;
    away_score?: number;
  };
};

function formatBasketLine(value: unknown): string | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const line = Math.round(numeric * 2) / 2;
  return line.toFixed(1);
}

function formatMarketLabel(market: string, analysis?: AdvancedAnalysis): string {
  const advancedLabel = analysis?.mercado?.label;
  if (advancedLabel) return advancedLabel;

  if (market === "over_total_points") {
    const line = formatBasketLine(analysis?.sport_detail?.projected_total_points);
    return line ? `OVER ${line} TOTAL POINTS` : "OVER TOTAL POINTS";
  }

  return market.replaceAll("_", " ").toUpperCase();
}

export default function GameDetailsPage() {
  const params = useParams<{ id: string }>();
  const matchId = Number(params?.id ?? 0);

  const [game, setGame] = useState<Game | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(matchId) || matchId <= 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [gameData, preds] = await Promise.all([
          api.getGameById(matchId),
          api.getPredictions(false, matchId),
        ]);

        if ((gameData as { error?: string }).error) {
          setNotFound(true);
          return;
        }

        setGame(gameData as Game);
        setPredictions(preds);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [matchId]);

  const bestPrediction = useMemo(() => {
    if (predictions.length === 0) return null;
    return [...predictions].sort((a, b) => b.score - a.score)[0];
  }, [predictions]);

  const bestAnalysis = useMemo(() => {
    if (!bestPrediction?.analise_avancada) return null;
    return bestPrediction.analise_avancada as AdvancedAnalysis;
  }, [bestPrediction]);

  const tipsterCall = useMemo(() => {
    if (!bestPrediction) {
      return {
        title: "NAO APOSTAR",
        subtitle: "Sem mercado qualificado no momento.",
      };
    }

    const risk = bestAnalysis?.integridade?.risco_manipulacao ?? "baixo";
    const confidence = bestAnalysis?.recomendacao?.confianca ?? "baixa";

    if (bestPrediction.ev <= 0) {
      return {
        title: "NAO APOSTAR",
        subtitle: "EV negativo para a melhor linha atual.",
      };
    }

    if (risk === "alto") {
      return {
        title: "APOSTAR COM PROTECAO",
        subtitle: "Há sinal de risco alto de manipulação; reduzir exposição.",
      };
    }

    if (confidence === "alta" || bestPrediction.score >= 0.5) {
      return {
        title: "APOSTAR AGORA",
        subtitle: "Melhor combinação de score, EV e risco controlado.",
      };
    }

    return {
      title: "APOSTAR COM CAUTELA",
      subtitle: "Mercado favorável, mas com confiança intermediária.",
    };
  }, [bestPrediction, bestAnalysis]);

  const checklistLabel: Record<string, string> = {
    ev_positive: "EV positivo agora",
    integrity_gate_ok: "Sem bloqueio por manipulação",
    odds_in_range: "Odd dentro da faixa segura",
    data_quality_ok: "Dados confiáveis",
  };

  if (loading) {
    return (
      <section className="elite-surface rounded-2xl p-6">
        <p className="text-sm text-slate">Carregando análise do jogo...</p>
      </section>
    );
  }

  if (notFound || !game) {
    return (
      <section className="elite-surface rounded-2xl p-6">
        <h2 className="font-[var(--font-display)] text-xl font-semibold text-ink">Partida não encontrada</h2>
        <p className="mt-2 text-sm text-slate">Esse jogo não está disponível na base atual.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/dashboard" className="inline-flex rounded-lg border border-mist bg-white px-3 py-2 text-sm font-semibold text-ink">
            Voltar ao dashboard
          </Link>
          <Link href="/predictions" className="inline-flex rounded-lg border border-cyan bg-cyan px-3 py-2 text-sm font-semibold text-white">
            Ver predições
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="desk-hero rounded-[32px] p-6 md:p-8">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="desk-kicker">Game Details</p>
            <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-[#f3f7ff] md:text-4xl">
              {game.home_team} x {game.away_team}
            </h1>
            <p className="mt-2 text-sm text-[#d7e2f4]">
              {new Date(game.date).toLocaleString()} · {game.sport.toUpperCase()} · Match #{game.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="elite-btn elite-btn-secondary">Dashboard</Link>
            <Link href="/predictions" className="elite-btn elite-btn-primary">Predições</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <article className="desk-card rounded-[24px] p-5 xl:col-span-2">
          <p className="desk-kicker text-[#55739d]">Resumo</p>
          <p className="mt-3 text-sm text-slate">Predições geradas: {predictions.length}</p>
          <p className="mt-1 text-sm text-slate">Melhor mercado: {bestPrediction ? formatMarketLabel(bestPrediction.market, bestAnalysis ?? undefined) : "n/d"}</p>
          <p className="mt-1 text-sm text-slate">Score topo: {bestPrediction ? bestPrediction.score.toFixed(3) : "0.000"}</p>
        </article>
        <article className="desk-card-dark rounded-[24px] p-5 xl:col-span-3">
          <p className="desk-kicker text-[#8aa6cf]">Melhor opção para apostar</p>
          {bestPrediction ? (
            <>
              <p className="mt-2 text-base font-semibold text-[#7ce4cd]">{tipsterCall.title}</p>
              <p className="mt-1 text-sm text-[#d6e1ef]">{tipsterCall.subtitle}</p>
              <p className="mt-3 text-xl font-semibold text-white">{formatMarketLabel(bestPrediction.market, bestAnalysis ?? undefined)}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/5 p-3 text-sm text-[#d8e3f1]">Probabilidade<br /><span className="text-lg font-semibold text-white">{(bestPrediction.probability * 100).toFixed(1)}%</span></div>
                <div className="rounded-2xl bg-white/5 p-3 text-sm text-[#d8e3f1]">Odd / EV<br /><span className="text-lg font-semibold text-white">{bestPrediction.odds.toFixed(2)} / {bestPrediction.ev.toFixed(3)}</span></div>
                <div className="rounded-2xl bg-white/5 p-3 text-sm text-[#d8e3f1]">Stake / Score<br /><span className="text-lg font-semibold text-white">{bestAnalysis?.recomendacao?.sugestao_stake ?? "n/d"} / {String(bestAnalysis?.recomendacao?.score_entrada ?? "n/d")}</span></div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate">Sem recomendacao no momento.</p>
          )}
        </article>
        <article className="desk-card rounded-[24px] p-5 xl:col-span-3">
          <p className="desk-kicker text-[#55739d]">Comparação IA x casa</p>
          {bestPrediction ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-mist bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate">Linha IA</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{bestAnalysis?.comparativo_casa?.linha_ia ?? "n/d"}</p>
                </div>
                <div className="rounded-2xl border border-mist bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate">Linha casa</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{bestAnalysis?.comparativo_casa?.linha_casa ?? "n/d"}</p>
                </div>
                <div className="rounded-2xl border border-mist bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate">Edge</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{typeof bestAnalysis?.comparativo_casa?.edge_linha === "number" ? bestAnalysis.comparativo_casa.edge_linha.toFixed(1) : "n/d"}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate">{bestAnalysis?.operacao?.motivo_curto ?? "Sem justificativa operacional."}</p>
              <p className="mt-1 text-sm text-slate">Regra de invalidação: {bestAnalysis?.recomendacao?.invalidation_rule ?? "n/d"}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate">Sem comparação disponível para esse jogo.</p>
          )}
        </article>
        <article className="desk-card rounded-[24px] p-5 xl:col-span-2">
          <p className="desk-kicker text-[#55739d]">Leitura ao vivo</p>
          {bestPrediction ? (
            <>
              <p className="mt-2 text-base font-semibold text-ink">{bestAnalysis?.ao_vivo?.is_live ? "AO VIVO" : "PRE JOGO"}</p>
              <p className="mt-1 text-sm text-slate">Status: {bestAnalysis?.ao_vivo?.status_text ?? "n/d"}</p>
              <p className="mt-1 text-sm text-slate">Periodo: {String(bestAnalysis?.ao_vivo?.period ?? "n/d")} · Relogio: {bestAnalysis?.ao_vivo?.clock ?? "n/d"}</p>
              <p className="mt-1 text-sm text-slate">Placar: {String(bestAnalysis?.ao_vivo?.home_score ?? 0)} x {String(bestAnalysis?.ao_vivo?.away_score ?? 0)}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate">Sem leitura ao vivo para esse jogo.</p>
          )}
        </article>
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Gols</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{game.stats.goals}</p>
        </article>
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Escanteios</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{game.stats.corners}</p>
        </article>
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Chutes / no alvo</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{game.stats.shots} / {game.stats.shots_on_target}</p>
        </article>
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Cartões / Pontos</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{game.stats.cards} / {game.stats.points}</p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Checklist pré-entrada</p>
          {bestAnalysis?.checklist_pre_entrada?.items ? (
            <ul className="mt-2 space-y-1 text-sm text-slate">
              {Object.entries(bestAnalysis.checklist_pre_entrada.items).map(([key, ok]) => (
                <li key={key}>
                  {ok ? "OK" : "FALHA"} · {checklistLabel[key] ?? key.replaceAll("_", " ")}
                </li>
              ))}
              <li className="pt-1 font-semibold text-ink">
                Decisao final: {bestAnalysis.checklist_pre_entrada.aprovado ? "APOSTAR" : "NAO APOSTAR"}
              </li>
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate">Checklist indisponível.</p>
          )}
        </article>

        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Governança da decisão</p>
          <p className="mt-2 text-sm text-slate">Motivo: {bestAnalysis?.governanca?.motivo ?? "n/d"}</p>
          <p className="mt-1 text-sm text-slate">Risco: {bestAnalysis?.governanca?.risco ?? "n/d"}</p>
          <p className="mt-1 text-sm text-slate">Stake: {bestAnalysis?.governanca?.stake ?? "n/d"}</p>
          <p className="mt-1 text-sm text-slate">Condição inválida: {bestAnalysis?.governanca?.condicao_invalida ?? "n/d"}</p>
        </article>
      </section>

      <section className="desk-card rounded-[24px] p-5">
        <p className="desk-kicker text-[#55739d]">Análise avançada por esporte</p>
        {bestAnalysis?.sport_detail ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(bestAnalysis.sport_detail).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-mist bg-white/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate">{key.replaceAll("_", " ")}</p>
                <p className="mt-1 text-lg font-semibold text-ink">{String(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate">Sem dados avançados para este jogo.</p>
        )}
      </section>

      <section className="desk-card overflow-hidden rounded-[28px]">
        <div className="border-b border-mist px-4 py-3 md:px-5">
          <h2 className="font-[var(--font-display)] text-lg font-semibold text-ink">Mercados calculados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="desk-table min-w-full text-sm">
            <thead className="text-slate">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Mercado</th>
                <th className="px-4 py-3 text-left font-semibold">Prob.</th>
                <th className="px-4 py-3 text-left font-semibold">Odd</th>
                <th className="px-4 py-3 text-left font-semibold">EV</th>
                <th className="px-4 py-3 text-left font-semibold">Score</th>
                <th className="px-4 py-3 text-left font-semibold">Risco</th>
                <th className="px-4 py-3 text-left font-semibold">Leitura</th>
                <th className="px-4 py-3 text-left font-semibold">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((item) => {
                const analysis = item.analise_avancada as AdvancedAnalysis | undefined;

                const itemDecision = item.ev > 0
                  ? (analysis?.integridade?.risco_manipulacao === "alto" ? "APOSTAR COM PROTECAO" : "APOSTAR")
                  : "NAO APOSTAR";

                return (
                <tr key={item.id} className="border-t border-mist/70">
                  <td className="px-4 py-3">{formatMarketLabel(item.market, analysis)}</td>
                  <td className="px-4 py-3">{(item.probability * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">{item.odds.toFixed(2)}</td>
                  <td className={`px-4 py-3 font-semibold ${item.ev > 0 ? "text-cyan" : "text-amber"}`}>{item.ev.toFixed(3)}</td>
                  <td className="px-4 py-3">{item.score.toFixed(3)}</td>
                  <td className="px-4 py-3 capitalize">{analysis?.integridade?.risco_manipulacao ?? "n/d"}</td>
                  <td className="px-4 py-3">{analysis?.mercado?.rationale ?? itemDecision}</td>
                  <td className="px-4 py-3">{new Date(item.created_at).toLocaleString()}</td>
                </tr>
                );
              })}
              {predictions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-5 text-center text-slate">Sem predições para essa partida.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
