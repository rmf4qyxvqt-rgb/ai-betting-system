// Calibracao simples para reduzir excesso de confianca da probabilidade crua.
export function calibrarProbabilidade(probCrua, contexto = {}) {
  const prob = Math.max(1, Math.min(99, Number(probCrua)));
  const amostraLiga = Math.max(1, Number(contexto?.amostraLiga || 1));

  // Quanto menor a amostra, mais puxamos para 50 (conservador).
  const forca = Math.min(0.25, 8 / (amostraLiga + 20));
  const calibrada = prob + ((50 - prob) * forca);

  return Number(Math.max(1, Math.min(99, calibrada)).toFixed(2));
}
