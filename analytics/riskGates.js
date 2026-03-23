export function avaliarGatesProfissionais(entrada) {
  const edge = Number(entrada?.edge || 0);
  const risco = Number(entrada?.riscoTotal || 100);
  const confianca = Number(entrada?.confianca || 0);
  const integridade = String(entrada?.integridade || "NORMAL");

  const bloqueios = [];

  if (edge < 3) bloqueios.push("edge_baixo");
  if (risco >= 70) bloqueios.push("risco_excessivo");
  if (confianca < 45) bloqueios.push("confianca_baixa");
  if (integridade === "ALTO_RISCO") bloqueios.push("integridade_critica");

  return {
    aprovado: bloqueios.length === 0,
    bloqueios,
  };
}
