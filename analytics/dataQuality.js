export function validarJogoBruto(jogo) {
  if (!jogo) return { valido: false, motivo: "jogo_invalido" };

  const liga = jogo?.league?.name || jogo?.strLeague;
  const casa = jogo?.teams?.home?.name || jogo?.strHomeTeam;
  const fora = jogo?.teams?.away?.name || jogo?.strAwayTeam;

  if (!liga || !casa || !fora) {
    return { valido: false, motivo: "campos_obrigatorios_ausentes" };
  }

  return { valido: true, motivo: "ok" };
}

const DATA_MINIMA_PADRAO = "2026-03-23T00:00:00.000Z";

function obterDataMinimaConfigurada() {
  const dataEnv = process.env.MIN_GAME_DATE || DATA_MINIMA_PADRAO;
  const data = new Date(dataEnv);
  if (Number.isNaN(data.getTime())) {
    return new Date(DATA_MINIMA_PADRAO);
  }
  return data;
}

function parseDataJogo(jogo) {
  const dataTexto =
    jogo?.fixture?.date ||
    jogo?.date ||
    jogo?.strTimestamp ||
    jogo?.dateEvent ||
    null;

  if (!dataTexto) return null;
  const data = new Date(dataTexto);
  if (Number.isNaN(data.getTime())) return null;
  return data;
}

export function jogoDentroJanelaAtual(jogo, horasPassadasMax = 6, horasFuturasMax = 72) {
  const dataJogo = parseDataJogo(jogo);
  if (!dataJogo) return false;

  const agora = Date.now();
  const diffMs = dataJogo.getTime() - agora;
  const limitePassado = -horasPassadasMax * 60 * 60 * 1000;
  const limiteFuturo = horasFuturasMax * 60 * 60 * 1000;

  return diffMs >= limitePassado && diffMs <= limiteFuturo;
}

export function jogoDoDiaAtual(jogo) {
  const dataTexto =
    jogo?.fixture?.date ||
    jogo?.date ||
    jogo?.strTimestamp ||
    jogo?.dateEvent ||
    null;

  if (!dataTexto) return false;
  const dataJogo = new Date(dataTexto);
  if (Number.isNaN(dataJogo.getTime())) return false;

  const hoje = new Date();
  return (
    dataJogo.getFullYear() === hoje.getFullYear() &&
    dataJogo.getMonth() === hoje.getMonth() &&
    dataJogo.getDate() === hoje.getDate()
  );
}

export function jogoAPartirDataMinima(jogo) {
  const dataTexto =
    jogo?.fixture?.date ||
    jogo?.date ||
    jogo?.strTimestamp ||
    jogo?.dateEvent ||
    null;

  if (!dataTexto) return false;
  const dataJogo = new Date(dataTexto);
  if (Number.isNaN(dataJogo.getTime())) return false;

  return dataJogo.getTime() >= obterDataMinimaConfigurada().getTime();
}

export function removerDuplicadosJogos(jogos) {
  const mapa = new Map();

  for (const jogo of jogos) {
    const chave = [
      jogo?.league?.name || jogo?.strLeague || "liga",
      jogo?.teams?.home?.name || jogo?.strHomeTeam || "casa",
      jogo?.teams?.away?.name || jogo?.strAwayTeam || "fora",
      jogo?.fixture?.date || jogo?.strTimestamp || jogo?.dateEvent || "data",
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, jogo);
    }
  }

  return Array.from(mapa.values());
}

export function normalizarTimezoneISO(dataTexto) {
  if (!dataTexto) return new Date().toISOString();
  const data = new Date(dataTexto);
  if (Number.isNaN(data.getTime())) return new Date().toISOString();
  return data.toISOString();
}

export function filtrarJogosValidos(jogos) {
  return jogos.filter((jogo) => {
    const basicoOk = validarJogoBruto(jogo).valido;
    if (!basicoOk) return false;

    // Mantem somente partidas a partir da data base configurada.
    return jogoAPartirDataMinima(jogo);
  });
}
