import fs from "fs";

const CAMINHO_SPLIT = "./database/split_temporal.json";

export function gerarSplitTemporal(jogos) {
  const ordenados = [...jogos].sort((a, b) => {
    const da = new Date(a?.horario || 0).getTime();
    const db = new Date(b?.horario || 0).getTime();
    return da - db;
  });

  const n = ordenados.length;
  const limiteTreino = Math.floor(n * 0.6);
  const limiteValidacao = Math.floor(n * 0.8);

  const treino = ordenados.slice(0, limiteTreino);
  const validacao = ordenados.slice(limiteTreino, limiteValidacao);
  const teste = ordenados.slice(limiteValidacao);

  const resumo = {
    total: n,
    treino: treino.length,
    validacao: validacao.length,
    teste: teste.length,
    geradoEm: new Date().toISOString(),
  };

  fs.writeFileSync(
    CAMINHO_SPLIT,
    JSON.stringify(
      {
        resumo,
        treino,
        validacao,
        teste,
      },
      null,
      2
    )
  );

  return resumo;
}

export function carregarSplitTemporal() {
  if (!fs.existsSync(CAMINHO_SPLIT)) return null;
  return JSON.parse(fs.readFileSync(CAMINHO_SPLIT, "utf-8"));
}
