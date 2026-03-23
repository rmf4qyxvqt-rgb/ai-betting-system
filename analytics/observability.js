import fs from "fs";

const CAMINHO_LOG = "./database/observabilidade.log.jsonl";

export function registrarEvento(evento) {
  const linha = JSON.stringify({
    id: `evt_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
    ...evento,
  });
  fs.appendFileSync(CAMINHO_LOG, `${linha}\n`);
}

export function lerEventosRecentes(limite = 50) {
  if (!fs.existsSync(CAMINHO_LOG)) return [];

  const linhas = fs
    .readFileSync(CAMINHO_LOG, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((linha) => {
      try {
        return JSON.parse(linha);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return linhas.slice(-limite);
}
