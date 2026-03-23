export type Game = {
  id: number;
  date: string;
  sport: string;
  home_team: string;
  away_team: string;
  stats: {
    goals: number;
    corners: number;
    shots: number;
    shots_on_target: number;
    cards: number;
    points: number;
  };
};

export type GameResponse = Game & {
  error?: string;
  game_id?: number;
};

export type Prediction = {
  id: number;
  match_id: number;
  market: string;
  probability: number;
  odds: number;
  ev: number;
  score: number;
  recommended: boolean;
  created_at: string;
  sport: string;
  home_team: string;
  away_team: string;
  analise_avancada?: Record<string, unknown>;
};

export type DashboardSummary = {
  total_predicoes: number;
  ao_vivo: number;
  ev_positivo: number;
  fortes: number;
  edge_medio: number;
  mercados: Record<string, { total: number; positivos: number; executar: number }>;
};

export type TopOpportunity = {
  match_id: number;
  market: string;
  market_label?: string;
  is_live?: boolean;
  live_status?: string;
  house_line?: number | null;
  ai_line?: number | null;
  line_edge?: number | null;
  reason?: string | null;
  score_entrada: number;
  tier: string;
  stake: string;
  ev: number;
  odd: number;
  home_team: string;
  away_team: string;
  sport: string;
  date: string;
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export const api = {
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  getTodayGames: () => request<Game[]>("/games/today"),
  getGameById: (gameId: number) => request<GameResponse>(`/games/${gameId}`),
  getPredictions: (recommendedOnly = true, matchId?: number) =>
    request<Prediction[]>(
      `/predictions?recommended_only=${recommendedOnly}${typeof matchId === "number" ? `&match_id=${matchId}` : ""}`
    ),
  getTopOpportunities: (limit = 5) => request<TopOpportunity[]>(`/opportunities/top?limit=${limit}`),
  syncNow: () => request<{ games_synced: number; predictions_synced: number }>("/sync-now", { method: "POST" }),
};
