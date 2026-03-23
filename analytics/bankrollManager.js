import fs from "fs";

const CAMINHO_BANCA = "./database/banca.json";

function garantirBanca() {
  if (!fs.existsSync(CAMINHO_BANCA)) {
    const inicial = {
      bancaAtual: 1000,
      stakeMinima: 5,
      stakeMaxima: 50,
      historico: [],
      atualizadoEm: new Date().toISOString(),
    };
    fs.writeFileSync(CAMINHO_BANCA, JSON.stringify(inicial, null, 2));
  }
}

export function carregarBanca() {
  garantirBanca();
  return JSON.parse(fs.readFileSync(CAMINHO_BANCA, "utf-8"));
}

export function calcularStakeSugerida(probRealPct, odd, confianca = 50) {
  const banca = carregarBanca();
  const p = Math.max(0.01, Math.min(0.99, Number(probRealPct) / 100));
  const b = Math.max(0.01, Number(odd) - 1);

  // Kelly fracionado (25%) para reduzir volatilidade.
  const kelly = ((b * p) - (1 - p)) / b;
  const fracao = Math.max(0, kelly) * 0.25;

  let stake = banca.bancaAtual * fracao * (Math.max(20, Math.min(100, confianca)) / 100);
  stake = Math.max(banca.stakeMinima, Math.min(banca.stakeMaxima, stake));

  return Number(stake.toFixed(2));
}

export function atualizarBanca(resultado) {
  const banca = carregarBanca();
  banca.bancaAtual = Number((banca.bancaAtual + Number(resultado?.lucro || 0)).toFixed(2));
  banca.historico.push({
    ...resultado,
    saldo: banca.bancaAtual,
    atualizadoEm: new Date().toISOString(),
  });
  banca.atualizadoEm = new Date().toISOString();
  fs.writeFileSync(CAMINHO_BANCA, JSON.stringify(banca, null, 2));
  return banca;
}
