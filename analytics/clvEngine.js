import fs from "fs";

const CAMINHO_CLV = "./database/clv_historico.json";

function garantirArquivo() {
  if (!fs.existsSync(CAMINHO_CLV)) {
    fs.writeFileSync(CAMINHO_CLV, JSON.stringify([], null, 2));
  }
}

export function calcularCLV(oddEntrada, oddFechamento) {
  const entrada = Math.max(1.01, Number(oddEntrada));
  const fechamento = Math.max(1.01, Number(oddFechamento));

  // CLV positivo quando a odd de fechamento cai apos entrada.
  const clv = ((entrada - fechamento) / entrada) * 100;
  return Number(clv.toFixed(4));
}

export function registrarCLV(registro) {
  garantirArquivo();
  const historico = JSON.parse(fs.readFileSync(CAMINHO_CLV, "utf-8"));

  const item = {
    id: `clv_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    liga: registro?.liga || "Liga desconhecida",
    mercado: registro?.mercado || "mercado_geral",
    oddEntrada: Number(registro?.oddEntrada || 0),
    oddFechamento: Number(registro?.oddFechamento || 0),
    clv: Number(registro?.clv || 0),
    criadoEm: new Date().toISOString(),
  };

  historico.push(item);
  fs.writeFileSync(CAMINHO_CLV, JSON.stringify(historico, null, 2));
  return item;
}

export function resumoCLV() {
  garantirArquivo();
  const historico = JSON.parse(fs.readFileSync(CAMINHO_CLV, "utf-8"));
  if (historico.length === 0) {
    return {
      totalRegistros: 0,
      mediaCLV: 0,
      positivos: 0,
      negativos: 0,
    };
  }

  const total = historico.length;
  const soma = historico.reduce((acc, x) => acc + Number(x.clv || 0), 0);
  const positivos = historico.filter((x) => Number(x.clv || 0) > 0).length;
  const negativos = historico.filter((x) => Number(x.clv || 0) < 0).length;

  return {
    totalRegistros: total,
    mediaCLV: Number((soma / total).toFixed(4)),
    positivos,
    negativos,
  };
}
