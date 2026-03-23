import fs from "fs";

const CAMINHO_METRICAS = "./database/metricas_negocio.json";

function arred(valor) {
  return Number(Number(valor).toFixed(4));
}

export function calcularMetricasNegocio(jogos) {
  const apostas = jogos.filter((j) => j?.decisao?.apostaExecutada);

  let lucroTotal = 0;
  let pico = 0;
  let acumulado = 0;
  let maxDrawdown = 0;
  let acertos = 0;

  for (const jogo of apostas) {
    const stake = Number(jogo?.decisao?.stake || 0);
    const odd = Number(jogo?.edge?.odd || 1);
    const venceu = Boolean(jogo?.resultadoSimulado?.venceu);

    const lucro = venceu ? (stake * (odd - 1)) : -stake;
    lucroTotal += lucro;
    acumulado += lucro;
    if (venceu) acertos += 1;

    pico = Math.max(pico, acumulado);
    const drawdown = pico - acumulado;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  const totalApostas = apostas.length;
  const totalStake = apostas.reduce((acc, j) => acc + Number(j?.decisao?.stake || 0), 0);
  const roi = totalStake > 0 ? lucroTotal / totalStake : 0;
  const yieldPct = totalApostas > 0 ? (lucroTotal / totalApostas) : 0;
  const hitRate = totalApostas > 0 ? (acertos / totalApostas) : 0;

  const metricas = {
    totalJogos: jogos.length,
    totalApostas,
    lucroTotal: arred(lucroTotal),
    roi: arred(roi),
    yield: arred(yieldPct),
    hitRate: arred(hitRate),
    maxDrawdown: arred(maxDrawdown),
    atualizadoEm: new Date().toISOString(),
  };

  fs.writeFileSync(CAMINHO_METRICAS, JSON.stringify(metricas, null, 2));
  return metricas;
}

export function carregarMetricas() {
  if (!fs.existsSync(CAMINHO_METRICAS)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(CAMINHO_METRICAS, "utf-8"));
}
