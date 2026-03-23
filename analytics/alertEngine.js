export function gerarAlertasAutomaticos(jogos, metricas, clvResumo) {
  const alertas = [];

  const jogosRiscoAlto = jogos.filter((j) => Number(j?.risco?.riscoTotal || 0) >= 70).length;
  if (jogosRiscoAlto > 0) {
    alertas.push({
      nivel: "alto",
      titulo: "Risco elevado identificado",
      detalhe: `${jogosRiscoAlto} jogo(s) com risco acima de 70.`,
    });
  }

  if (Number(metricas?.roi || 0) < 0) {
    alertas.push({
      nivel: "medio",
      titulo: "ROI negativo",
      detalhe: `ROI atual em ${Number(metricas.roi * 100).toFixed(2)}%.`,
    });
  }

  if (Number(clvResumo?.mediaCLV || 0) < 0) {
    alertas.push({
      nivel: "medio",
      titulo: "CLV medio negativo",
      detalhe: `CLV medio em ${Number(clvResumo.mediaCLV).toFixed(2)}%.`,
    });
  }

  const oportunidadesElite = jogos.filter((j) => String(j?.ranking?.classe || "") === "ELITE").length;
  if (oportunidadesElite > 0) {
    alertas.push({
      nivel: "baixo",
      titulo: "Oportunidades elite",
      detalhe: `${oportunidadesElite} jogo(s) com score elite detectado(s).`,
    });
  }

  if (alertas.length === 0) {
    alertas.push({
      nivel: "baixo",
      titulo: "Operacao estavel",
      detalhe: "Sem alertas criticos no momento.",
    });
  }

  return alertas;
}
