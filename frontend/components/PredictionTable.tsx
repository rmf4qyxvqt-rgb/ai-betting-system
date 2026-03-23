import { Prediction } from "@/services/api";
import Link from "next/link";

type PredictionTableProps = {
  predictions: Prediction[];
};

function formatBasketLine(value: unknown): string | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const line = Math.round(numeric * 2) / 2;
  return line.toFixed(1);
}

function formatMarketLabel(item: Prediction): string {
  const advanced = item.analise_avancada as { mercado?: { label?: string } } | undefined;
  const customLabel = advanced?.mercado?.label;
  if (customLabel) return customLabel;

  if (item.market === "over_total_points") {
    const analysis = item.analise_avancada as { sport_detail?: { projected_total_points?: number | string } } | undefined;
    const line = formatBasketLine(analysis?.sport_detail?.projected_total_points);
    return line ? `OVER ${line} TOTAL POINTS` : "OVER TOTAL POINTS";
  }

  return item.market.replaceAll("_", " ").toUpperCase();
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function decisionChip(item: Prediction) {
  const analysis = item.analise_avancada as {
    operacao?: { sinal?: string };
  } | undefined;
  const signal = analysis?.operacao?.sinal;
  if (signal === "executar") return "desk-chip desk-chip-green";
  if (signal === "monitorar") return "desk-chip desk-chip-amber";
  return "desk-chip desk-chip-red";
}

function decisionText(item: Prediction) {
  const analysis = item.analise_avancada as {
    operacao?: { sinal?: string };
    comparativo_casa?: { edge_linha?: number | null };
  } | undefined;
  const signal = analysis?.operacao?.sinal;
  const edge = analysis?.comparativo_casa?.edge_linha;
  if (signal === "executar") return `Executar${typeof edge === "number" ? ` · edge ${edge.toFixed(1)}` : ""}`;
  if (signal === "monitorar") return "Monitorar";
  return "Evitar";
}

export function PredictionTable({ predictions }: PredictionTableProps) {
  return (
    <section className="desk-card fade-in overflow-hidden rounded-[28px]">
      <div className="flex flex-col gap-2 border-b border-mist/70 px-5 py-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="desk-kicker text-[#55739d]">Mercados Prioritários</p>
          <h2 className="font-[var(--font-display)] text-xl font-semibold text-ink">Comparação IA x linha de casa</h2>
        </div>
        <p className="text-sm text-slate">Use o edge da linha como critério principal e a decisão como filtro operacional.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="desk-table min-w-full text-sm">
          <thead className="text-slate">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Jogo</th>
              <th className="px-4 py-3 text-left font-semibold">Mercado</th>
              <th className="px-4 py-3 text-left font-semibold">Probabilidade IA</th>
              <th className="px-4 py-3 text-left font-semibold">IA x Casa</th>
              <th className="px-4 py-3 text-left font-semibold">Odd</th>
              <th className="px-4 py-3 text-left font-semibold">Decisão</th>
              <th className="px-4 py-3 text-left font-semibold">Motivo</th>
              <th className="px-4 py-3 text-left font-semibold">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {predictions.map((item) => {
              const analysis = item.analise_avancada as {
                comparativo_casa?: { linha_ia?: number | null; linha_casa?: number | null; edge_linha?: number | null };
                operacao?: { motivo_curto?: string };
              } | undefined;

              return (
              <tr key={item.id}>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-ink">{item.home_team} x {item.away_team}</div>
                  <div className="mt-1 text-xs text-slate">EV {item.ev.toFixed(3)} · score {item.score.toFixed(3)}</div>
                </td>
                <td className="px-4 py-3 align-top font-medium text-ink">{formatMarketLabel(item)}</td>
                <td className="px-4 py-3 align-top">{pct(item.probability)}</td>
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-ink">
                    {analysis?.comparativo_casa?.linha_ia ?? "n/d"} / {analysis?.comparativo_casa?.linha_casa ?? "n/d"}
                  </div>
                  <div className="mt-1 text-xs text-slate">edge {typeof analysis?.comparativo_casa?.edge_linha === "number" ? analysis.comparativo_casa.edge_linha.toFixed(1) : "n/d"}</div>
                </td>
                <td className="px-4 py-3 align-top">{item.odds.toFixed(2)}</td>
                <td className="px-4 py-3 align-top">
                  <span className={decisionChip(item)}>{decisionText(item)}</span>
                </td>
                <td className="px-4 py-3 align-top text-slate">{analysis?.operacao?.motivo_curto ?? "Sem motivo disponível."}</td>
                <td className="px-4 py-3 align-top">
                  <Link
                    href={`/games/${item.match_id}`}
                    className="inline-flex rounded-full border border-mist bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-[#b99050] hover:text-[#7a5419]"
                  >
                    Ver jogo
                  </Link>
                </td>
              </tr>
            );})}
            {predictions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate">
                  Nenhuma recomendação positiva no momento.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
