export function calcularRiscoFinal(dados) {
  let risco = 0;
  let relatorio = [];

  // =========================
  // Manipulacao Estatistica
  // =========================
  if (dados.manipulacao > 70) {
    risco += 30;
    relatorio.push("Forte indicio estatistico de manipulacao");
  }

  // =========================
  // Arbitro suspeito
  // =========================
  if (dados.arbitro > 60) {
    risco += 20;
    relatorio.push("Arbitro com padrao anormal");
  }

  // =========================
  // Time entregando
  // =========================
  if (dados.timeEntregando > 65) {
    risco += 25;
    relatorio.push("Time apresenta queda comportamental suspeita");
  }

  // =========================
  // Movimento de Odds
  // =========================
  if (dados.odds > 70) {
    risco += 25;
    relatorio.push("Odds com movimento tipico de armadilha");
  }

  // =========================
  // Classificacao Final
  // =========================
  let nivel = "SEGURO";

  if (risco >= 70) nivel = "ABSURDO";
  else if (risco >= 50) nivel = "ALTO RISCO";
  else if (risco >= 30) nivel = "ATENCAO";

  return {
    riscoTotal: risco,
    nivel,
    relatorio,
  };
}
