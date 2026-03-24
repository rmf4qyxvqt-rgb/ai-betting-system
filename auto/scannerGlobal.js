import fs from "fs";
import fetch from "node-fetch";
import { calcularRiscoFinal } from "../engine/riskEngine.js";
import { aprenderLiga } from "../ia/ligaInteligente.js";
import { detectarEdge } from "../ia/edgeDetector.js";
import { filtrarJogosValidos, normalizarTimezoneISO, removerDuplicadosJogos } from "../analytics/dataQuality.js";
import { calibrarProbabilidade } from "../analytics/calibration.js";
import { obterUltimoModelo, registrarModelo } from "../analytics/modelRegistry.js";
import { avaliarGatesProfissionais } from "../analytics/riskGates.js";
import { carregarBanca, calcularStakeSugerida, atualizarBanca } from "../analytics/bankrollManager.js";
import { registrarEvento } from "../analytics/observability.js";
import { calcularMetricasNegocio } from "../analytics/metricsEngine.js";
import { executarBacktestTemporal } from "../analytics/backtestEngine.js";
import { calcularCLV, registrarCLV, resumoCLV } from "../analytics/clvEngine.js";
import { gerarSplitTemporal } from "../analytics/temporalSplit.js";
import { gerarRelatorioMensal } from "../analytics/monthlyReport.js";
import { calcularXGSimplificado } from "../analytics/xgEngine.js";
import { ranquearOportunidades } from "../analytics/opportunityRanker.js";
import { gerarAlertasAutomaticos } from "../analytics/alertEngine.js";

const DB = "./database/jogosHoje.json";
const CACHE_DB = "./database/source_cache.json";

// ===== CONFIG =====
const API_KEY = process.env.API_SPORTS_KEY || "";
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || "";
const USE_PAID_SOURCES = String(process.env.USE_PAID_SOURCES || "false").toLowerCase() === "true";
const LOOKAHEAD_DAYS = Math.max(1, Number(process.env.LOOKAHEAD_DAYS || 7));
const CACHE_TTL_MINUTES = Math.max(1, Number(process.env.SOURCE_CACHE_TTL_MINUTES || 30));
const IS_PRODUCTION = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
// ==================

function listaDatasISO(qtdDias = 7) {
  const datas = [];
  const agora = new Date();
  for (let i = 0; i < qtdDias; i++) {
    const d = new Date(agora);
    d.setDate(agora.getDate() + i);
    datas.push(d.toISOString().split("T")[0]);
  }
  return datas;
}

function carregarCacheFontes() {
  if (!fs.existsSync(CACHE_DB)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_DB));
  } catch {
    return {};
  }
}

function salvarCacheFontes(cache) {
  if (IS_PRODUCTION) {
    console.log("[VERCEL] Pulando escrita de cache (filesystem read-only)");
    return;
  }
  fs.writeFileSync(CACHE_DB, JSON.stringify(cache, null, 2));
}

function salvarNoCache(chave, payload) {
  const cache = carregarCacheFontes();
  cache[chave] = {
    atualizadoEm: new Date().toISOString(),
    payload,
  };
  salvarCacheFontes(cache);
}

function lerDoCache(chave) {
  const cache = carregarCacheFontes();
  const entrada = cache[chave];
  if (!entrada?.atualizadoEm || !entrada?.payload) return null;

  const idadeMs = Date.now() - new Date(entrada.atualizadoEm).getTime();
  const ttlMs = CACHE_TTL_MINUTES * 60 * 1000;
  if (idadeMs > ttlMs) return null;

  return entrada.payload;
}

function salvar(dados) {
  if (IS_PRODUCTION) {
    console.log("[VERCEL] Pulando escrita de dados (filesystem read-only)");
    return;
  }
  fs.writeFileSync(DB, JSON.stringify(dados, null, 2));
}

function carregar() {
  if (!fs.existsSync(DB)) return [];
  return JSON.parse(fs.readFileSync(DB));
}

function normalizarJogoPadrao(jogo, esporte) {
  const ligaNome = jogo?.league?.name || jogo?.strLeague || "Liga desconhecida";
  return {
    esporte,
    league: {
      name: ligaNome,
    },
    teams: {
      home: {
        name: jogo?.teams?.home?.name || jogo?.strHomeTeam || "Time casa",
      },
      away: {
        name: jogo?.teams?.away?.name || jogo?.strAwayTeam || "Time fora",
      },
    },
    fixture: {
      date: jogo?.fixture?.date || jogo?.date || jogo?.strTimestamp || jogo?.dateEvent,
    },
    date: jogo?.date || jogo?.strTimestamp || jogo?.dateEvent,
    metaEvento: {
      torneio: ligaNome,
      categoria: jogo?.league?.country || jogo?.strSport || esporte,
      status: jogo?.strStatus || jogo?.fixture?.status?.long || jogo?.status || "agendado",
    },
    _meta: {
      sintetico: false,
      fonte: "desconhecida",
    },
  };
}

function anexarMetaFonte(jogos, fonte, sintetico = false) {
  return (jogos || []).map((jogo) => ({
    ...jogo,
    _meta: {
      sintetico,
      fonte,
    },
  }));
}

function normalizarJogoFootballData(match) {
  return {
    esporte: "futebol",
    league: {
      name: match?.competition?.name || "Liga desconhecida",
    },
    teams: {
      home: {
        name: match?.homeTeam?.name || "Time casa",
      },
      away: {
        name: match?.awayTeam?.name || "Time fora",
      },
    },
    fixture: {
      date: match?.utcDate,
    },
    date: match?.utcDate,
    metaEvento: {
      torneio: match?.competition?.name || "Liga desconhecida",
      categoria: match?.area?.name || "Internacional",
      status: match?.status || "SCHEDULED",
    },
  };
}

function normalizarJogoESPN(evento) {
  const comp = evento?.competitions?.[0] || {};
  const competitors = comp?.competitors || [];
  const home = competitors.find((c) => c?.homeAway === "home");
  const away = competitors.find((c) => c?.homeAway === "away");

  return {
    esporte: "futebol",
    league: {
      name: evento?.league?.name || comp?.league?.name || evento?.shortName || "Liga desconhecida",
    },
    teams: {
      home: {
        name: home?.team?.displayName || home?.team?.name || "Time casa",
      },
      away: {
        name: away?.team?.displayName || away?.team?.name || "Time fora",
      },
    },
    fixture: {
      date: comp?.date || evento?.date,
    },
    date: comp?.date || evento?.date,
    metaEvento: {
      torneio: evento?.name || evento?.shortName || evento?.league?.name || "Torneio ESPN",
      categoria: evento?.league?.abbreviation || evento?.season?.type?.name || "ESPN",
      status: comp?.status?.type?.description || comp?.status?.type?.name || "agendado",
    },
    _meta: {
      sintetico: false,
      fonte: "ESPN Gratis",
    },
  };
}

function normalizarJogoSofaScore(evento, esporte) {
  const inicio = evento?.startTimestamp
    ? new Date(Number(evento.startTimestamp) * 1000).toISOString()
    : evento?.startDate || null;

  return {
    esporte,
    league: {
      name:
        evento?.tournament?.name ||
        evento?.season?.name ||
        evento?.tournament?.category?.name ||
        "Liga desconhecida",
    },
    teams: {
      home: {
        name: evento?.homeTeam?.name || "Time casa",
      },
      away: {
        name: evento?.awayTeam?.name || "Time fora",
      },
    },
    fixture: {
      date: inicio,
    },
    date: inicio,
    metaEvento: {
      torneio: evento?.tournament?.name || "Torneio SofaScore",
      categoria: evento?.tournament?.category?.name || "SofaScore",
      status: evento?.status?.description || evento?.status?.type || "agendado",
    },
    _meta: {
      sintetico: false,
      fonte: `SofaScore ${esporte === "futebol" ? "Futebol" : "Basquete"}`,
    },
  };
}

async function buscarEventosSofaScore(esporte, datas) {
  const slug = esporte === "futebol" ? "football" : "basketball";
  let eventos = [];

  for (const dataISO of datas) {
    const res = await fetch(
      `https://api.sofascore.com/api/v1/sport/${slug}/scheduled-events/${dataISO}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
          Referer: "https://www.sofascore.com/",
        },
      }
    );

    if (!res.ok) continue;
    const json = await res.json();
    eventos = eventos.concat(json?.events || []);
  }

  return eventos;
}

function criarJogoFallback(esporte, liga, casa, fora, horaDoDiaUTC = 12) {
  const agora = new Date();
  const dataDiaAtual = new Date(Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate(),
    horaDoDiaUTC,
    0,
    0
  )).toISOString();
  return {
    esporte,
    league: {
      name: liga,
    },
    teams: {
      home: { name: casa },
      away: { name: fora },
    },
    fixture: {
      date: dataDiaAtual,
    },
    date: dataDiaAtual,
    _meta: {
      sintetico: true,
      fonte: "fallback_local",
    },
  };
}

function garantirVolumeJogos(jogos, minimo = 12) {
  // Sem fallback sintético: retorna somente jogos reais capturados nas APIs.
  return [...(jogos || [])];
}

function classificarEdge(valorEdge) {
  if (valorEdge > 15) return "EDGE ABSURDO";
  if (valorEdge > 10) return "EDGE ALTO";
  if (valorEdge > 5) return "EDGE BOM";
  if (valorEdge > 2) return "EDGE FRACO";
  return "SEM VALOR";
}

function gerarOddsPorCasa(oddBase) {
  const casas = ["Pinnacle", "Bet365", "SBO", "1xBet"];
  const oddsPorCasa = {};

  for (const casa of casas) {
    const variacao = 1 + ((Math.random() - 0.5) * 0.08);
    oddsPorCasa[casa] = Number((oddBase * variacao).toFixed(2));
  }

  return oddsPorCasa;
}

// BUSCAR FUTEBOL
async function buscarFutebol() {
  const datas = listaDatasISO(LOOKAHEAD_DAYS);
  const hoje = datas[0];
  const ultimoDia = datas[datas.length - 1];
  const chaveCache = `futebol_${hoje}_${ultimoDia}`;

  let acumuladoGratis = [];
  const fontesUsadas = new Set();

  // Fonte gratis sem chave: SofaScore.
  try {
    const eventosSofa = await buscarEventosSofaScore("futebol", datas);
    const jogosSofa = anexarMetaFonte(
      eventosSofa.map((evento) => normalizarJogoSofaScore(evento, "futebol")),
      "SofaScore Futebol"
    );

    if (jogosSofa.length > 0) {
      acumuladoGratis = acumuladoGratis.concat(jogosSofa);
      fontesUsadas.add("SofaScore Futebol");
      salvarNoCache(chaveCache, { jogos: jogosSofa, fonte: "SofaScore Futebol (cache)" });
    }
  } catch (erro) {
    console.log("SofaScore futebol indisponivel.");
  }

  // Fonte gratis com chave free tier (opcional).
  if (FOOTBALL_DATA_KEY.trim()) {
    try {
      const resFootballData = await fetch(
        `https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${ultimoDia}`,
        {
          headers: {
            "X-Auth-Token": FOOTBALL_DATA_KEY,
          },
        }
      );

      if (resFootballData.ok) {
        const dataFootballData = await resFootballData.json();
        const jogos = anexarMetaFonte(
          (dataFootballData.matches || []).map((jogo) => normalizarJogoFootballData(jogo)),
          "Football-Data"
        );
        if (jogos.length > 0) {
          acumuladoGratis = acumuladoGratis.concat(jogos);
          fontesUsadas.add("Football-Data");
          salvarNoCache(chaveCache, { jogos, fonte: "Football-Data (cache)" });
        }
      }
    } catch (erro) {
      console.log("Football-Data indisponivel, mantendo fontes gratis sem chave.");
    }
  }

  // Fonte gratis sem chave: ESPN (multiplas ligas).
  try {
    const ligasESPN = ["eng.1", "esp.1", "ger.1", "ita.1", "fra.1", "bra.1", "uefa.champions"];
    let eventosESPN = [];
    for (const dataISO of datas) {
      const dataCompacta = dataISO.replace(/-/g, "");
      for (const liga of ligasESPN) {
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/scoreboard?dates=${dataCompacta}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        eventosESPN = eventosESPN.concat(json?.events || []);
      }
    }

    const jogosESPN = anexarMetaFonte(
      eventosESPN.map((evento) => normalizarJogoESPN(evento)),
      "ESPN Gratis"
    );
    if (jogosESPN.length > 0) {
      acumuladoGratis = acumuladoGratis.concat(jogosESPN);
      fontesUsadas.add("ESPN Gratis");
      salvarNoCache(chaveCache, { jogos: jogosESPN, fonte: "ESPN Gratis (cache)" });
    }
  } catch (erro) {
    console.log("ESPN gratis indisponivel.");
  }

  // Fonte gratis sem chave: OpenLigaDB.
  try {
    let eventosOpenLiga = [];
    for (const dataISO of datas) {
      const res = await fetch(`https://www.openligadb.de/api/getmatchdata/${dataISO}`);
      if (!res.ok) continue;
      const json = await res.json();
      eventosOpenLiga = eventosOpenLiga.concat(json || []);
    }

    const jogosOpenLiga = anexarMetaFonte(
      eventosOpenLiga.map((jogo) => ({
        esporte: "futebol",
        league: {
          name: jogo?.leagueName || "OpenLigaDB",
        },
        teams: {
          home: {
            name: jogo?.team1?.teamName || "Time casa",
          },
          away: {
            name: jogo?.team2?.teamName || "Time fora",
          },
        },
        fixture: {
          date: jogo?.matchDateTimeUTC || jogo?.matchDateTime,
        },
        date: jogo?.matchDateTimeUTC || jogo?.matchDateTime,
        metaEvento: {
          torneio: jogo?.leagueName || "OpenLigaDB",
          categoria: jogo?.leagueShortcut || "OpenLigaDB",
          status: jogo?.matchIsFinished ? "finalizado" : "agendado",
        },
      })),
      "OpenLigaDB Gratis"
    );

    if (jogosOpenLiga.length > 0) {
      acumuladoGratis = acumuladoGratis.concat(jogosOpenLiga);
      fontesUsadas.add("OpenLigaDB Gratis");
      salvarNoCache(chaveCache, { jogos: jogosOpenLiga, fonte: "OpenLigaDB Gratis (cache)" });
    }
  } catch (erro) {
    console.log("OpenLigaDB indisponivel.");
  }

  // Fonte gratis sem chave: TheSportsDB.
  try {
    let acumuladoPublico = [];
    for (const dataISO of datas) {
      const resPublica = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dataISO}&s=Soccer`
      );

      if (!resPublica.ok) {
        continue;
      }

      const dataPublica = await resPublica.json();
      acumuladoPublico = acumuladoPublico.concat(dataPublica.events || []);
    }

    const jogosSportsDB = anexarMetaFonte(
      acumuladoPublico.map((jogo) => normalizarJogoPadrao(jogo, "futebol")),
      "TheSportsDB Futebol"
    );
    if (jogosSportsDB.length > 0) {
      acumuladoGratis = acumuladoGratis.concat(jogosSportsDB);
      fontesUsadas.add("TheSportsDB Futebol");
      salvarNoCache(chaveCache, { jogos: jogosSportsDB, fonte: "TheSportsDB Futebol (cache)" });
    }
  } catch (erro) {
    console.log("TheSportsDB indisponivel.");
  }

  if (acumuladoGratis.length > 0) {
    const resp = {
      jogos: acumuladoGratis,
      fonte: Array.from(fontesUsadas).join(" + ") || "Fontes gratis",
    };
    salvarNoCache(chaveCache, resp);
    return resp;
  }

  // Fonte paga opcional (desligada por padrao).
  if (USE_PAID_SOURCES && API_KEY.trim()) {
    try {
      let acumulado = [];
      for (const dataISO of datas) {
        const res = await fetch(
          `https://v3.football.api-sports.io/fixtures?date=${dataISO}`,
          {
            headers: {
              "x-apisports-key": API_KEY,
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          acumulado = acumulado.concat(data.response || []);
        }
      }

      const jogos = anexarMetaFonte(
        acumulado.map((jogo) => normalizarJogoPadrao(jogo, "futebol")),
        "API-Sports Futebol"
      );
      if (jogos.length > 0) {
        const resp = { jogos, fonte: "API-Sports Futebol" };
        salvarNoCache(chaveCache, resp);
        return resp;
      }
    } catch (erro) {
      console.log("API-Sports indisponivel.");
    }
  }

  const cache = lerDoCache(chaveCache);
  if (cache) {
    return {
      jogos: cache.jogos || [],
      fonte: `${cache.fonte || "cache"}`,
    };
  }

  return { jogos: [], fonte: "nenhuma_fonte_disponivel" };
}

// BUSCAR BASQUETE
async function buscarBasquete() {
  const datas = listaDatasISO(LOOKAHEAD_DAYS);
  const hoje = datas[0];
  const ultimoDia = datas[datas.length - 1];
  const chaveCache = `basquete_${hoje}_${ultimoDia}`;

  try {
    const eventosSofa = await buscarEventosSofaScore("basquete", datas);
    const jogosSofa = anexarMetaFonte(
      eventosSofa.map((evento) => normalizarJogoSofaScore(evento, "basquete")),
      "SofaScore Basquete"
    );

    if (jogosSofa.length > 0) {
      const resp = { jogos: jogosSofa, fonte: "SofaScore Basquete" };
      salvarNoCache(chaveCache, resp);
      return resp;
    }
  } catch (erro) {
    console.log("SofaScore basquete indisponivel.");
  }

  if (USE_PAID_SOURCES && API_KEY.trim()) {
    try {
      let acumulado = [];
      for (const dataISO of datas) {
        const res = await fetch(
          `https://v1.basketball.api-sports.io/games?date=${dataISO}`,
          {
            headers: {
              "x-apisports-key": API_KEY,
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          acumulado = acumulado.concat(data.response || []);
        }
      }

      const jogos = anexarMetaFonte(
        acumulado.map((jogo) => normalizarJogoPadrao(jogo, "basquete")),
        "API-Sports Basquete"
      );
      if (jogos.length > 0) {
        const resp = { jogos, fonte: "API-Sports Basquete" };
        salvarNoCache(chaveCache, resp);
        return resp;
      }
    } catch (erro) {
      console.log("API-Sports basquete indisponivel.");
    }
  }

  // Fallback com jogos reais de API publica em janela de dias.
  let acumuladoPublico = [];
  for (const dataISO of datas) {
    const resPublica = await fetch(
      `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dataISO}&s=Basketball`
    );

    if (!resPublica.ok) {
      continue;
    }

    const dataPublica = await resPublica.json();
    acumuladoPublico = acumuladoPublico.concat(dataPublica.events || []);
  }

  const respPublica = {
    jogos: anexarMetaFonte(
      acumuladoPublico.map((jogo) => normalizarJogoPadrao(jogo, "basquete")),
      "TheSportsDB Basquete"
    ),
    fonte: "TheSportsDB Basquete",
  };

  if ((respPublica.jogos || []).length > 0) {
    salvarNoCache(chaveCache, respPublica);
    return respPublica;
  }

  const cache = lerDoCache(chaveCache);
  if (cache) {
    return {
      jogos: cache.jogos || [],
      fonte: `${cache.fonte || "cache"}`,
    };
  }

  return respPublica;
}

// SIMULA DADOS PARA IA (voce pode melhorar depois)
function montarDadosIA(jogo) {
  return {
    oddsSuspeitas: Math.random() * 100,
    arbitragemRisco: Math.random() * 100,
    comportamentoTime: Math.random() * 100,
    variacaoMercado: Math.random() * 100,
  };
}

// ANALISAR JOGO
function analisarJogo(jogo, esporte) {
  const dadosIA = montarDadosIA(jogo);

  const risco = calcularRiscoFinal({
    manipulacao: dadosIA.oddsSuspeitas,
    arbitro: dadosIA.arbitragemRisco,
    timeEntregando: dadosIA.comportamentoTime,
    odds: dadosIA.variacaoMercado,
  });

  const ligaNome = esporte === "futebol" ? jogo.league.name : jogo.league.name;

  const aprendizado = aprenderLiga(ligaNome, risco.riscoTotal);
  const edgeCru = detectarEdge({
    risco,
  });
  const probCalibrada = calibrarProbabilidade(edgeCru.probReal, {
    amostraLiga: aprendizado?.jogosAnalisados,
  });

  const edgeCalibrado = Number((probCalibrada - Number(edgeCru.probCasa)).toFixed(2));
  const edge = {
    odd: edgeCru.odd,
    probReal: probCalibrada,
    probCasa: Number(Number(edgeCru.probCasa).toFixed(2)),
    edge: edgeCalibrado,
    nivel: classificarEdge(edgeCalibrado),
  };

  const oddsPorCasa = gerarOddsPorCasa(edge.odd);
  const clvPorCasa = Object.entries(oddsPorCasa).map(([casa, oddCasa]) => {
    const fechamentoCasa = Number((oddCasa * (1 + ((Math.random() - 0.5) * 0.1))).toFixed(2));
    const clvCasa = calcularCLV(oddCasa, fechamentoCasa);
    return {
      casa,
      oddEntrada: oddCasa,
      oddFechamento: fechamentoCasa,
      clv: clvCasa,
    };
  });

  // Simula fechamento de linha para controle de CLV.
  const oddFechamento = Number((edge.odd * (1 + ((Math.random() - 0.5) * 0.12))).toFixed(2));
  const clv = calcularCLV(edge.odd, oddFechamento);
  const clvRegistro = registrarCLV({
    liga: ligaNome,
    mercado: esporte === "futebol" ? "mercado_futebol" : "mercado_basquete",
    oddEntrada: edge.odd,
    oddFechamento,
    clv,
  });

  const xg = calcularXGSimplificado({
    risco,
    edge,
  });

  const confiancaModelo = Math.max(15, 100 - risco.riscoTotal);
  const gates = avaliarGatesProfissionais({
    edge: edge.edge,
    riscoTotal: risco.riscoTotal,
    confianca: confiancaModelo,
    integridade: risco.nivel === "ABSURDO" ? "ALTO_RISCO" : "NORMAL",
  });

  const stake = gates.aprovado
    ? calcularStakeSugerida(edge.probReal, edge.odd, confiancaModelo)
    : 0;

  const apostaExecutada = stake > 0;
  const venceu = apostaExecutada ? Math.random() < (edge.probReal / 100) : false;
  const lucro = apostaExecutada ? (venceu ? (stake * (edge.odd - 1)) : -stake) : 0;

  if (apostaExecutada) {
    atualizarBanca({
      jogo: `${jogo.teams.home.name} x ${jogo.teams.away.name}`,
      stake,
      odd: edge.odd,
      venceu,
      lucro,
    });
  }

  const decisao = {
    apostaExecutada,
    aprovadoGates: gates.aprovado,
    bloqueios: gates.bloqueios,
    stake,
    confiancaModelo,
  };

  const resultadoSimulado = {
    venceu,
    lucro: Number(lucro.toFixed(2)),
  };

  registrarEvento({
    tipo: "decisao_jogo",
    jogo: `${jogo.teams.home.name} x ${jogo.teams.away.name}`,
    liga: ligaNome,
    riscoTotal: risco.riscoTotal,
    edge: edge.edge,
    aprovadoGates: gates.aprovado,
    stake,
    lucro: resultadoSimulado.lucro,
  });

  return {
    esporte,
    mercado: esporte === "futebol" ? "mercado_futebol" : "mercado_basquete",
    liga: ligaNome,
    torneio: jogo?.metaEvento?.torneio || ligaNome,
    categoria: jogo?.metaEvento?.categoria || esporte,
    statusJogo: jogo?.metaEvento?.status || "desconhecido",
    casa: esporte === "futebol" ? jogo.teams.home.name : jogo.teams.home.name,
    fora: esporte === "futebol" ? jogo.teams.away.name : jogo.teams.away.name,
    risco: risco,
    edge,
    xg,
    oddsPorCasa,
    clvPorCasa,
    clv: {
      oddEntrada: edge.odd,
      oddFechamento,
      clv: clvRegistro.clv,
    },
    ligaInfo: aprendizado,
    decisao,
    resultadoSimulado,
    horario: normalizarTimezoneISO(jogo.fixture?.date || jogo.date),
    origemDados: {
      sintetico: Boolean(jogo?._meta?.sintetico),
      fonte: jogo?._meta?.fonte || "desconhecida",
    },
  };
}

// SCANNER PRINCIPAL
export async function executarScannerGlobal() {
  console.log("Escaneando jogos do mundo...");

  if (!obterUltimoModelo()) {
    registrarModelo({
      nome: "modelo_edge_risco",
      versao: "1.0.0",
      features: ["riscoTotal", "odd", "probCasa", "probReal", "edge"],
      metrica: { tipo: "bootstrap" },
    });
  }

  const futebolResp = await buscarFutebol();
  const basqueteResp = await buscarBasquete();
  const futebol = futebolResp?.jogos || [];
  const basquete = basqueteResp?.jogos || [];
  const jogosUnicos = removerDuplicadosJogos([...futebol, ...basquete]);
  const jogosValidos = filtrarJogosValidos(jogosUnicos);
  const jogosParaAnalise = garantirVolumeJogos(jogosValidos, 12);
  const sinteticosAdicionados = jogosParaAnalise.filter((j) => Boolean(j?._meta?.sintetico)).length;
  const reaisCapturados = jogosParaAnalise.length - sinteticosAdicionados;

  const diagnostico = {
    status: reaisCapturados > 0 ? "ok" : "sem_jogos_reais",
    apiSportsConfigurada: Boolean(API_KEY.trim()),
    footballDataConfigurada: Boolean(FOOTBALL_DATA_KEY.trim()),
    totalJogosReaisCapturados: reaisCapturados,
    totalJogosSinteticos: sinteticosAdicionados,
    recomendacoes: [],
  };

  if (!diagnostico.apiSportsConfigurada) {
    diagnostico.recomendacoes.push("API_SPORTS_KEY ausente (opcional): modo gratuito continua ativo.");
  }

  if (!diagnostico.footballDataConfigurada) {
    diagnostico.recomendacoes.push("Preencher FOOTBALL_DATA_KEY (free tier) para ampliar cobertura gratis de futebol.");
  }

  if (reaisCapturados === 0) {
    diagnostico.recomendacoes.push("Sem jogos reais na janela atual das fontes; verificar conectividade, limites da API e data/hora local.");
  }

  const resultados = [];

  jogosParaAnalise.forEach((jogo) => {
    resultados.push(analisarJogo(jogo, jogo.esporte || "futebol"));
  });

  salvar(resultados);

  const historicoAtual = carregar();
  const jogosRanqueados = ranquearOportunidades(historicoAtual);
  salvar(jogosRanqueados);

  const metricas = calcularMetricasNegocio(jogosRanqueados);
  const backtest = executarBacktestTemporal(jogosRanqueados);
  const splitTemporal = gerarSplitTemporal(jogosRanqueados);
  const relatorioMensal = gerarRelatorioMensal(jogosRanqueados);
  const clvResumo = resumoCLV();
  const banca = carregarBanca();
  const alertas = gerarAlertasAutomaticos(jogosRanqueados, metricas, clvResumo);

  console.log(`${resultados.length} jogos analisados`);

  return {
    status: "ok",
    mensagem: "Scanner global executado com sucesso.",
    totalJogos: resultados.length,
    fontes: {
      futebol: {
        fonte: futebolResp?.fonte || "desconhecida",
        capturados: futebol.length,
      },
      basquete: {
        fonte: basqueteResp?.fonte || "desconhecida",
        capturados: basquete.length,
      },
      totalBruto: futebol.length + basquete.length,
      totalPosFiltro: jogosValidos.length,
      totalPosGarantia: jogosParaAnalise.length,
      reaisCapturados,
      sinteticosAdicionados,
      atualizadoEm: new Date().toISOString(),
    },
    diagnostico,
    jogos: jogosRanqueados,
    metricas,
    clv: clvResumo,
    alertas,
    splitTemporal,
    backtest: {
      retornoPct: backtest.retornoPct,
      maxDrawdown: backtest.maxDrawdown,
      pontosCurva: backtest.pontosCurva,
    },
    relatorioMensal: relatorioMensal.slice(0, 20),
    banca: {
      bancaAtual: banca.bancaAtual,
      atualizadoEm: banca.atualizadoEm,
    },
  };
}

export async function scannerGlobal() {
  return executarScannerGlobal();
}
