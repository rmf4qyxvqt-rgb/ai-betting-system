# 🎯 AI Betting System - Control Room

Sistema profissional de análise de apostas com comparação IA vs Casa, edge tracking e decisões operacionais.

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2014-black)
![FastAPI](https://img.shields.io/badge/backend-FastAPI-009688)

---

## 🚀 DEPLOY RÁPIDO (2 CLIQUES)

### ⚡ **Deploy Automático**

👉 **[CLIQUE AQUI para Deploy](./DEPLOY_GUIA.md)** ← Instruções completas

Ou siga diretamente:

1. **Frontend (Vercel):**
   ```
   https://vercel.com/new/clone?repository-url=https://github.com/rmf4qyxvqt-rgb/ai-betting-system&rootDirectory=frontend
   ```

2. **Backend (Railway):**
   ```
   https://railway.app/new?repo=https://github.com/rmf4qyxvqt-rgb/ai-betting-system
   ```

---

## 📁 Estrutura

```text
ai-betting-system/
  ├── frontend/          (Next.js 14 - Dashboard profissional)
  ├── backend/           (FastAPI - Motor de análises)
  ├── database/          (SQLite - Persistência local)
  ├── analytics/         (Engines de análise)
  └── DEPLOY_GUIA.md    (📋 Leia primeiro!)
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
