function limitar(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

export function calcularXGSimplificado(jogo) {
  const risco = Number(jogo?.risco?.riscoTotal || 50);
  const odd = Number(jogo?.edge?.odd || 2.0);
  const edge = Number(jogo?.edge?.edge || 0);

  // Modelo simplificado: combina qualidade da chance (edge), risco e odd.
  const baseMandante = 1.15 + (edge * 0.02) - (risco * 0.003) + ((2.2 - odd) * 0.15);
  const baseVisitante = 1.05 - (edge * 0.01) + (risco * 0.002);

  const xgMandante = limitar(Number(baseMandante.toFixed(3)), 0.2, 3.5);
  const xgVisitante = limitar(Number(baseVisitante.toFixed(3)), 0.2, 3.2);
  const xgTotal = Number((xgMandante + xgVisitante).toFixed(3));

  return {
    xgMandante,
    xgVisitante,
    xgTotal,
  };
}
