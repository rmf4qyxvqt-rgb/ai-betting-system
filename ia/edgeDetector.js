// Converte odd em probabilidade implicita
function probabilidadeDaOdd(odd) {
  return (1 / odd) * 100;
}

// Calcula EDGE
function calcularEdge(probReal, odd) {
  const probCasa = probabilidadeDaOdd(odd);

  const edge = probReal - probCasa;

  let nivel = "SEM VALOR";

  if (edge > 15) nivel = "EDGE ABSURDO";
  else if (edge > 10) nivel = "EDGE ALTO";
  else if (edge > 5) nivel = "EDGE BOM";
  else if (edge > 2) nivel = "EDGE FRACO";

  return {
    probReal,
    probCasa,
    edge: Number(edge.toFixed(2)),
    nivel,
  };
}

// IA estima probabilidade real usando seus riscos
export function calcularProbabilidadeReal(risco) {
  // Quanto menor risco, maior probabilidade.
  const base = 70 - (risco.riscoTotal * 0.5);

  const prob = Math.max(5, Math.min(95, base));

  return prob;
}

// Funcao principal
export function detectarEdge(jogo) {
  // Simulacao inicial (depois voce liga odds reais).
  const oddSimulada = 1.60 + Math.random();

  const probReal = calcularProbabilidadeReal(jogo.risco);

  const edgeInfo = calcularEdge(probReal, oddSimulada);

  return {
    odd: Number(oddSimulada.toFixed(2)),
    ...edgeInfo,
  };
}
