import fs from "fs";

const caminhoDB = "./database/ligas.json";

function carregarDB() {
  return JSON.parse(fs.readFileSync(caminhoDB));
}

function salvarDB(data) {
  fs.writeFileSync(caminhoDB, JSON.stringify(data, null, 2));
}

export function aprenderLiga(nomeLiga, riscoJogo) {
  let db = carregarDB();

  let liga = db.find((l) => l.nome === nomeLiga);

  if (!liga) {
    liga = {
      nome: nomeLiga,
      jogosAnalisados: 0,
      riscoAcumulado: 0,
      nivelPerigo: "DESCONHECIDO",
    };
    db.push(liga);
  }

  liga.jogosAnalisados += 1;
  liga.riscoAcumulado += riscoJogo;

  const media = liga.riscoAcumulado / liga.jogosAnalisados;

  if (media > 70) liga.nivelPerigo = "EXTREMAMENTE PERIGOSA";
  else if (media > 50) liga.nivelPerigo = "ALTO RISCO";
  else if (media > 30) liga.nivelPerigo = "ATENCAO";
  else liga.nivelPerigo = "NORMAL";

  salvarDB(db);

  return liga;
}
