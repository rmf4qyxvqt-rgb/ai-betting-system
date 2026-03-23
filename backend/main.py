from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, Base, get_db, SessionLocal
import crud
from services.data_collector import update_games_from_source
from services.prediction_engine import generate_daily_predictions
from scheduler import start_scheduler, stop_scheduler

app = FastAPI(title="AI Sports Analytics System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        update_games_from_source(db)
        generate_daily_predictions(db)
    finally:
        db.close()

    start_scheduler()


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()


@app.get("/games/today")
def get_games_today(db: Session = Depends(get_db)):
    games = crud.get_today_games(db)
    response = []
    for g in games:
        response.append(
            {
                "id": g.id,
                "date": g.date,
                "sport": g.sport,
                "home_team": g.home_team_rel.name if g.home_team_rel else str(g.home_team),
                "away_team": g.away_team_rel.name if g.away_team_rel else str(g.away_team),
                "stats": {
                    "goals": g.stat.goals if g.stat else 0,
                    "corners": g.stat.corners if g.stat else 0,
                    "shots": g.stat.shots if g.stat else 0,
                    "shots_on_target": g.stat.shots_on_target if g.stat else 0,
                    "cards": g.stat.cards if g.stat else 0,
                    "points": g.stat.points if g.stat else 0,
                },
            }
        )
    return response


@app.get("/predictions")
def get_predictions(recommended_only: bool = True, match_id: int | None = None, db: Session = Depends(get_db)):
    preds = crud.get_predictions(db, recommended_only=recommended_only, match_id=match_id)
    response = []
    for p in preds:
        response.append(
            {
                "id": p.id,
                "match_id": p.match_id,
                "market": p.market,
                "probability": p.probability,
                "odds": p.odds,
                "ev": p.ev,
                "score": p.score,
                "recommended": p.recommended,
                "analise_avancada": p.analise_avancada or {},
                "created_at": p.created_at,
                "sport": p.match.sport if p.match else "unknown",
                "home_team": p.match.home_team_rel.name if p.match and p.match.home_team_rel else "N/A",
                "away_team": p.match.away_team_rel.name if p.match and p.match.away_team_rel else "N/A",
            }
        )
    return response


@app.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    preds = crud.get_predictions(db, recommended_only=False)

    total = len(preds)
    live = 0
    positive = 0
    strong = 0
    edges = []
    by_family = {}

    for p in preds:
        analysis = p.analise_avancada or {}
        recommendation = analysis.get("recomendacao", {}) if isinstance(analysis, dict) else {}
        live_info = analysis.get("ao_vivo", {}) if isinstance(analysis, dict) else {}
        compare = analysis.get("comparativo_casa", {}) if isinstance(analysis, dict) else {}
        operation = analysis.get("operacao", {}) if isinstance(analysis, dict) else {}

        if live_info.get("is_live"):
            live += 1
        if p.ev > 0:
            positive += 1
        if int(recommendation.get("score_entrada", 0) or 0) >= 80:
            strong += 1

        edge = compare.get("edge_linha")
        if isinstance(edge, (int, float)):
            edges.append(float(edge))

        family = str(compare.get("mercado_familia", "jogo_inteiro"))
        if family not in by_family:
            by_family[family] = {"total": 0, "positivos": 0, "executar": 0}
        by_family[family]["total"] += 1
        if p.ev > 0:
            by_family[family]["positivos"] += 1
        if operation.get("sinal") == "executar":
            by_family[family]["executar"] += 1

    avg_edge = round(sum(edges) / len(edges), 2) if edges else 0.0

    return {
        "total_predicoes": total,
        "ao_vivo": live,
        "ev_positivo": positive,
        "fortes": strong,
        "edge_medio": avg_edge,
        "mercados": by_family,
    }


@app.get("/opportunities/top")
def get_top_opportunities(limit: int = 5, db: Session = Depends(get_db)):
    preds = crud.get_predictions(db, recommended_only=False)

    best_by_match = {}
    for p in preds:
        analysis = p.analise_avancada or {}
        recommendation = analysis.get("recomendacao", {}) if isinstance(analysis, dict) else {}
        market_info = analysis.get("mercado", {}) if isinstance(analysis, dict) else {}
        live_info = analysis.get("ao_vivo", {}) if isinstance(analysis, dict) else {}
        score_entrada = int(recommendation.get("score_entrada", 0) or 0)

        current = best_by_match.get(p.match_id)
        if current is None or score_entrada > current["score_entrada"]:
            best_by_match[p.match_id] = {
                "match_id": p.match_id,
                "market": p.market,
                "market_label": market_info.get("label", p.market.replace("_", " ").upper()),
                "is_live": bool(live_info.get("is_live", False)),
                "live_status": str(live_info.get("status_text", "")),
                "house_line": analysis.get("comparativo_casa", {}).get("linha_casa") if isinstance(analysis, dict) else None,
                "ai_line": analysis.get("comparativo_casa", {}).get("linha_ia") if isinstance(analysis, dict) else None,
                "line_edge": analysis.get("comparativo_casa", {}).get("edge_linha") if isinstance(analysis, dict) else None,
                "reason": analysis.get("operacao", {}).get("motivo_curto") if isinstance(analysis, dict) else None,
                "score_entrada": score_entrada,
                "tier": recommendation.get("tier", "evitar"),
                "stake": recommendation.get("sugestao_stake", "0u"),
                "ev": p.ev,
                "odd": p.odds,
                "home_team": p.match.home_team_rel.name if p.match and p.match.home_team_rel else "N/A",
                "away_team": p.match.away_team_rel.name if p.match and p.match.away_team_rel else "N/A",
                "sport": p.match.sport if p.match else "unknown",
                "date": p.match.date if p.match else None,
            }

    top = sorted(best_by_match.values(), key=lambda x: x["score_entrada"], reverse=True)[: max(1, min(limit, 20))]
    return top


@app.get("/games/{game_id}")
def get_game_by_id(game_id: int, db: Session = Depends(get_db)):
    game = crud.get_match_by_id(db, game_id)
    if not game:
        raise HTTPException(status_code=404, detail={"error": "game_not_found", "game_id": game_id})

    return {
        "id": game.id,
        "date": game.date,
        "sport": game.sport,
        "home_team": game.home_team_rel.name if game.home_team_rel else str(game.home_team),
        "away_team": game.away_team_rel.name if game.away_team_rel else str(game.away_team),
        "stats": {
            "goals": game.stat.goals if game.stat else 0,
            "corners": game.stat.corners if game.stat else 0,
            "shots": game.stat.shots if game.stat else 0,
            "shots_on_target": game.stat.shots_on_target if game.stat else 0,
            "cards": game.stat.cards if game.stat else 0,
            "points": game.stat.points if game.stat else 0,
        },
    }


@app.post("/sync-now")
def sync_now(db: Session = Depends(get_db)):
    games = update_games_from_source(db)
    preds = generate_daily_predictions(db)
    return {"games_synced": len(games), "predictions_synced": len(preds)}


@app.get("/")
def root():
    return {"status": "ok", "service": "AI Sports Analytics MVP"}
