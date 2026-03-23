function limitar(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

export function calcularScoreOportunidade(jogo) {
  const edge = Number(jogo?.edge?.edge || 0);
  const risco = Number(jogo?.risco?.riscoTotal || 100);
  const clv = Number(jogo?.clv?.clv || 0);
  const confianca = Number(jogo?.decisao?.confiancaModelo || 0);
  const xgTotal = Number(jogo?.xg?.xgTotal || 1.5);

  const scoreBruto =
    (edge * 2.2) +
    (confianca * 0.35) +
    (clv * 0.9) +
    (xgTotal * 6) -
    (risco * 0.6);

  const score = limitar(Number(scoreBruto.toFixed(2)), 0, 100);

  let classe = "NEUTRA";
  if (score >= 75) classe = "ELITE";
  else if (score >= 60) classe = "ALTA";
  else if (score >= 40) classe = "MEDIA";
  else if (score >= 20) classe = "BAIXA";

  return { score, classe };
}

export function ranquearOportunidades(jogos) {
  return [...jogos]
    .map((jogo) => {
      const ranking = calcularScoreOportunidade(jogo);
      return { ...jogo, ranking };
    })
    .sort((a, b) => Number(b?.ranking?.score || 0) - Number(a?.ranking?.score || 0));
}
