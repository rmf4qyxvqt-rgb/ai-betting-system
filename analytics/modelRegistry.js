import fs from "fs";

const CAMINHO_REGISTRY = "./database/model_registry.json";

function garantirArquivo() {
  if (!fs.existsSync(CAMINHO_REGISTRY)) {
    fs.writeFileSync(CAMINHO_REGISTRY, JSON.stringify([], null, 2));
  }
}

export function carregarRegistry() {
  garantirArquivo();
  return JSON.parse(fs.readFileSync(CAMINHO_REGISTRY, "utf-8"));
}

export function registrarModelo(modelo) {
  const registry = carregarRegistry();
  const versao = {
    id: `modelo_${Date.now()}`,
    nome: modelo?.nome || "modelo_edge_risco",
    versao: modelo?.versao || "1.0.0",
    features: modelo?.features || [],
    metrica: modelo?.metrica || {},
    criadoEm: new Date().toISOString(),
  };
  registry.push(versao);
  fs.writeFileSync(CAMINHO_REGISTRY, JSON.stringify(registry, null, 2));
  return versao;
}

export function obterUltimoModelo() {
  const registry = carregarRegistry();
  return registry.length ? registry[registry.length - 1] : null;
}
