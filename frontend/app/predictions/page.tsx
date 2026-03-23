"use client";

import { useEffect, useState } from "react";
import { api, Prediction } from "@/services/api";
import { PredictionTable } from "@/components/PredictionTable";

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const data = await api.getPredictions(true);
    setPredictions(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function syncData() {
    setSyncing(true);
    try {
      await api.syncNow();
      await load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="desk-card-dark fade-in rounded-[28px] p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="desk-kicker text-[#8aa6cf]">Mercados do dia</p>
            <h2 className="font-[var(--font-display)] text-3xl font-semibold text-white">Mesa completa de oportunidades</h2>
            <p className="mt-2 text-sm text-[#cfdbeb]">Visual profissional focado em linha da IA, referência da casa e motivo operacional.</p>
          </div>
          <button
            onClick={syncData}
            disabled={syncing}
            className="rounded-full bg-[#d5aa62] px-5 py-2.5 text-sm font-semibold text-[#131c2c] transition hover:brightness-95 disabled:opacity-70"
          >
            {syncing ? "Sincronizando..." : "Atualizar agora"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Total EV+</p>
          <p className="mt-3 font-[var(--font-display)] text-4xl font-semibold text-ink">{predictions.length}</p>
          <p className="mt-2 text-sm text-slate">Mercados com valor positivo prontos para triagem.</p>
        </article>
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Maior EV</p>
          <p className="mt-3 font-[var(--font-display)] text-4xl font-semibold text-ink">{predictions[0] ? predictions[0].ev.toFixed(3) : "0.000"}</p>
          <p className="mt-2 text-sm text-slate">Valor esperado do melhor mercado atual.</p>
        </article>
        <article className="desk-card rounded-[24px] p-5">
          <p className="desk-kicker text-[#55739d]">Sincronização</p>
          <p className="mt-3 font-[var(--font-display)] text-4xl font-semibold text-ink">Manual</p>
          <p className="mt-2 text-sm text-slate">Use atualização manual antes de operar ao vivo.</p>
        </article>
      </section>

      <PredictionTable predictions={predictions} />
    </div>
  );
}
