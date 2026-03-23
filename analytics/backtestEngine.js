import fs from "fs";

const CAMINHO_BACKTEST = "./database/backtest_ultimo.json";

export function executarBacktestTemporal(jogos) {
  const ordenados = [...jogos].sort((a, b) => {
    const da = new Date(a?.horario || 0).getTime();
    const db = new Date(b?.horario || 0).getTime();
    return da - db;
  });

  let banca = 1000;
  let pico = banca;
  let drawdown = 0;
  const curva = [];

  for (const jogo of ordenados) {
    if (!jogo?.decisao?.apostaExecutada) continue;

    const stake = Number(jogo?.decisao?.stake || 0);
    const odd = Number(jogo?.edge?.odd || 1);
    const venceu = Boolean(jogo?.resultadoSimulado?.venceu);
    const lucro = venceu ? (stake * (odd - 1)) : -stake;

    banca += lucro;
    pico = Math.max(pico, banca);
    drawdown = Math.max(drawdown, pico - banca);

    curva.push({
      horario: jogo?.horario,
      banca: Number(banca.toFixed(2)),
      lucro: Number(lucro.toFixed(2)),
    });
  }

  const resultado = {
    bancaInicial: 1000,
    bancaFinal: Number(banca.toFixed(2)),
    retornoPct: Number((((banca - 1000) / 1000) * 100).toFixed(2)),
    maxDrawdown: Number(drawdown.toFixed(2)),
    pontosCurva: curva.length,
    curva,
    executadoEm: new Date().toISOString(),
  };

  fs.writeFileSync(CAMINHO_BACKTEST, JSON.stringify(resultado, null, 2));
  return resultado;
}

export function carregarBacktest() {
  if (!fs.existsSync(CAMINHO_BACKTEST)) return null;
  return JSON.parse(fs.readFileSync(CAMINHO_BACKTEST, "utf-8"));
}
