import fs from "fs";

const CAMINHO_RELATORIO = "./database/relatorio_mensal.json";

function chaveMes(data) {
  const d = new Date(data || Date.now());
  if (Number.isNaN(d.getTime())) return "desconhecido";
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

export function gerarRelatorioMensal(jogos) {
  const mapa = new Map();

  for (const jogo of jogos) {
    const mes = chaveMes(jogo?.horario);
    const liga = jogo?.liga || "Liga desconhecida";
    const mercado = jogo?.mercado || "mercado_geral";
    const chave = `${mes}|${liga}|${mercado}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        mes,
        liga,
        mercado,
        jogos: 0,
        apostas: 0,
        acertos: 0,
        stakeTotal: 0,
        lucroTotal: 0,
      });
    }

    const acc = mapa.get(chave);
    acc.jogos += 1;

    const aposta = Boolean(jogo?.decisao?.apostaExecutada);
    const stake = Number(jogo?.decisao?.stake || 0);
    const lucro = Number(jogo?.resultadoSimulado?.lucro || 0);
    const venceu = Boolean(jogo?.resultadoSimulado?.venceu);

    if (aposta) {
      acc.apostas += 1;
      acc.stakeTotal += stake;
      acc.lucroTotal += lucro;
      if (venceu) acc.acertos += 1;
    }
  }

  const relatorio = Array.from(mapa.values()).map((x) => {
    const roi = x.stakeTotal > 0 ? x.lucroTotal / x.stakeTotal : 0;
    const hitRate = x.apostas > 0 ? x.acertos / x.apostas : 0;
    return {
      ...x,
      roi: Number(roi.toFixed(4)),
      hitRate: Number(hitRate.toFixed(4)),
      lucroTotal: Number(x.lucroTotal.toFixed(2)),
      stakeTotal: Number(x.stakeTotal.toFixed(2)),
    };
  });

  fs.writeFileSync(
    CAMINHO_RELATORIO,
    JSON.stringify(
      {
        atualizadoEm: new Date().toISOString(),
        totalLinhas: relatorio.length,
        relatorio,
      },
      null,
      2
    )
  );

  return relatorio;
}

export function carregarRelatorioMensal() {
  if (!fs.existsSync(CAMINHO_RELATORIO)) return null;
  return JSON.parse(fs.readFileSync(CAMINHO_RELATORIO, "utf-8"));
}
