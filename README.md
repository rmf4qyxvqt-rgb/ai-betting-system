# AI Sports Analytics MVP

Projeto reiniciado em modo MVP enxuto.

Objetivo: mostrar jogos reais do dia (futebol e basquete) e gerar predições EV automaticamente.

## Estrutura

```text
ai-betting-system/
  backend/
  frontend/
  database/
```

## Backend (FastAPI)

### 1) Instalar dependências

```bash
cd backend
pip install -r requirements.txt
```

### 2) Configurar ambiente

- Se `DATABASE_URL` não for definido, usa SQLite local em `database/ai_sports.db`.
- API de jogos reais: TheSportsDB (free tier).

Variáveis opcionais:

```bash
SPORTSDB_API_KEY=3
SPORTSDB_TIMEOUT_SECONDS=20
```

### 3) Rodar API

```bash
uvicorn main:app --reload
```

### Endpoints MVP

- `GET /`
- `GET /games/today`
- `GET /games/{id}`
- `GET /predictions?recommended_only=true`
- `POST /sync-now`

## Frontend (Next.js)

### 1) Instalar dependências

```bash
cd frontend
npm install
```

### 2) Configurar API URL

Em `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3) Rodar frontend

```bash
npm run dev
```

### Rotas MVP

- `/`
- `/dashboard`
- `/predictions`
- `/games/[id]`

## Automação

No startup do backend:

- cria tabelas
- sincroniza jogos reais do dia
- gera predições EV
- inicia scheduler

Scheduler:

- sincronização de jogos + predições a cada 1 hora

## Fórmula EV

`EV = (probability * odds) - 1`
