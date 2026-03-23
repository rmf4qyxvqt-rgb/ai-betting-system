import random
from statistics import mean

from sqlalchemy.orm import Session

import crud
from services.data_collector import fetch_live_context_for_match

MARKETS_BY_SPORT = {
    "football": [
        "match_winner_home",
        "over_2_5_goals",
        "over_1h_goals",
        "over_2h_goals",
        "live_next_goal",
    ],
    "basketball": [
        "match_winner_home",
        "over_total_points",
        "over_1q_points",
        "over_1h_points",
        "over_3q_points",
        "over_2h_points",
        "live_over_total_points",
    ],
}


def _round_to_half(value: float) -> float:
    return round(value * 2.0) / 2.0


def _clamp_half_line(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, _round_to_half(value)))


def _market_family(market: str) -> str:
    if market.startswith("live_"):
        return "ao_vivo"
    if "1q" in market:
        return "primeiro_quarto"
    if "3q" in market:
        return "terceiro_quarto"
    if "1h" in market:
        return "primeiro_tempo"
    if "2h" in market:
        return "segundo_tempo"
    return "jogo_inteiro"


def _bet365_reference_line(market: str, projected_line: float | None) -> float | None:
    baselines = {
        "over_total_points": 214.5,
        "over_1q_points": 52.5,
        "over_1h_points": 106.5,
        "over_3q_points": 52.5,
        "over_2h_points": 106.5,
        "live_over_total_points": 216.5,
        "over_2_5_goals": 2.5,
        "over_1h_goals": 0.5,
        "over_2h_goals": 0.5,
    }
    reference = baselines.get(market)
    if projected_line is None:
        return reference
    if reference is None:
        return projected_line
    return _round_to_half((reference + projected_line) / 2.0)


def _value_edge_label(edge: float | None) -> str:
    if edge is None:
        return "sem_linha"
    if edge >= 2.0:
        return "forte"
    if edge >= 0.5:
        return "moderado"
    if edge > -0.5:
        return "neutro"
    return "fraco"


def _decision_reason(entry_score: int, ev: float, edge: float | None, live_context: dict, manipulation_level: str) -> str:
    if manipulation_level == "alto":
        return "Risco alto de mercado. So entrar com protecao ou nao entrar."
    if ev <= 0:
        return "Linha sem valor matematico agora. Melhor ficar fora."
    if live_context.get("is_live") and edge is not None and edge >= 1.5:
        return "Ao vivo com linha ainda atrasada em relacao ao ritmo atual."
    if edge is not None and edge >= 1.0 and entry_score >= 65:
        return "IA ve linha melhor que a referencia da casa e score sustentado."
    if entry_score >= 65:
        return "Entrada boa, mas sem margem larga sobre a referencia da casa."
    return "Cenario observavel, porem sem vantagem forte para executar agora."


def _compute_odd(probability: float) -> float:
    probability = min(max(probability, 0.08), 0.92)
    base = 1.0 / probability
    return max(1.2, min(8.0, round(base * random.uniform(0.95, 1.05), 2)))


def _seed_probability(match_id: int, market: str) -> float:
    rng = random.Random(f"{match_id}:{market}")
    return round(rng.uniform(0.42, 0.74), 4)


def _entry_score(ev: float, probability: float, manipulation_score: int, data_quality_score: int) -> int:
    ev_component = max(0.0, min(1.0, (ev + 0.12) / 0.24)) * 35.0
    prob_component = max(0.0, min(1.0, (probability - 0.45) / 0.35)) * 25.0
    integrity_component = (1.0 - (manipulation_score / 100.0)) * 25.0
    quality_component = max(0.0, min(1.0, data_quality_score / 100.0)) * 15.0
    return int(round(ev_component + prob_component + integrity_component + quality_component))


def _entry_tier(score: int) -> str:
    if score >= 80:
        return "entrada_principal"
    if score >= 65:
        return "entrada_moderada"
    if score >= 50:
        return "entrada_protecao"
    return "evitar"


def _stake_for_tier(tier: str) -> str:
    if tier == "entrada_principal":
        return "1.5u"
    if tier == "entrada_moderada":
        return "1.0u"
    if tier == "entrada_protecao":
        return "0.5u"
    return "0u"


def _bankroll_rules():
    return {
        "stake_policy": "fixed_by_tier",
        "daily_stop_loss_units": 4.0,
        "max_exposure_per_league_units": 3.0,
        "max_simultaneous_entries": 5,
    }


def _data_quality(game) -> dict:
    quality_score = 92
    issues = []

    if not game.date:
        quality_score -= 30
        issues.append("missing_date")

    if not game.home_team_rel or not game.away_team_rel:
        quality_score -= 40
        issues.append("missing_team_identity")

    if game.stat is None:
        quality_score -= 20
        issues.append("missing_stats")

    if quality_score >= 85:
        grade = "A"
    elif quality_score >= 65:
        grade = "B"
    else:
        grade = "C"

    return {
        "grade": grade,
        "score": max(0, quality_score),
        "issues": issues,
        "source_confirmations": 1,
    }


def _recent_values(matches, extractor):
    values = []
    for m in matches:
        if m.stat is None:
            continue
        values.append(float(extractor(m.stat)))
    return values


def _football_detail(db: Session, game):
    home_matches = crud.get_recent_team_matches(db, game.home_team, game.sport, game.date, limit=10)
    away_matches = crud.get_recent_team_matches(db, game.away_team, game.sport, game.date, limit=10)

    home_goals = _recent_values(home_matches, lambda s: s.goals)
    away_goals = _recent_values(away_matches, lambda s: s.goals)
    cards = _recent_values(home_matches + away_matches, lambda s: s.cards)
    corners = _recent_values(home_matches + away_matches, lambda s: s.corners)

    projected_total_goals = round(
        max(1.0, ((mean(home_goals) if home_goals else 0.0) + (mean(away_goals) if away_goals else 0.0)) / 2.0),
        2,
    )

    return {
        "avg_goals_home_last10": round(mean(home_goals), 2) if home_goals else 0.0,
        "avg_goals_away_last10": round(mean(away_goals), 2) if away_goals else 0.0,
        "projected_total_goals": projected_total_goals,
        "avg_cards_match_last20": round(mean(cards), 2) if cards else 0.0,
        "avg_corners_match_last20": round(mean(corners), 2) if corners else 0.0,
    }


def _basketball_detail(db: Session, game):
    home_matches = crud.get_recent_team_matches(db, game.home_team, game.sport, game.date, limit=10)
    away_matches = crud.get_recent_team_matches(db, game.away_team, game.sport, game.date, limit=10)

    # points em Stat representa pontos totais da partida no MVP.
    home_total_points = _recent_values(home_matches, lambda s: s.points)
    away_total_points = _recent_values(away_matches, lambda s: s.points)
    shots = _recent_values(home_matches + away_matches, lambda s: s.shots)
    shots_on_target = _recent_values(home_matches + away_matches, lambda s: s.shots_on_target)

    avg_home = mean(home_total_points) if home_total_points else 0.0
    avg_away = mean(away_total_points) if away_total_points else 0.0
    projected_total = round((avg_home + avg_away) / 2.0, 2) if (avg_home and avg_away) else round(max(avg_home, avg_away), 2)

    return {
        "avg_total_points_home_last10": round(avg_home, 2),
        "avg_total_points_away_last10": round(avg_away, 2),
        "projected_total_points": projected_total,
        "avg_shots_last20": round(mean(shots), 2) if shots else 0.0,
        "avg_shots_on_target_last20": round(mean(shots_on_target), 2) if shots_on_target else 0.0,
    }


def _manipulation_risk(match_id: int, market: str, odd: float, ev: float):
    rng = random.Random(f"risk:{match_id}:{market}")
    base = rng.uniform(0.15, 0.55)
    odd_pressure = max(0.0, (odd - 2.6) / 4.0)
    ev_pressure = max(0.0, min(0.2, ev * 0.5))
    risk_score = max(0, min(100, int((base + odd_pressure + ev_pressure) * 100)))

    if risk_score >= 70:
        return {
            "nivel": "alto",
            "score": risk_score,
            "alerta": "Oscilacao e precificacao fora do padrao. Exigir confirmacao antes da entrada.",
        }
    if risk_score >= 45:
        return {
            "nivel": "medio",
            "score": risk_score,
            "alerta": "Variacao moderada. Operar com stake reduzida e monitorar mercado.",
        }
    return {
        "nivel": "baixo",
        "score": risk_score,
        "alerta": "Mercado dentro da faixa normal para operacao.",
    }


def _build_market_metadata(game, market: str, sport_detail: dict, live_context: dict):
    sport = game.sport
    line = None
    label = market.replace("_", " ").upper()
    rationale = "Linha calculada com base no historico recente e risco atual."

    if sport == "basketball":
        projected = float(sport_detail.get("projected_total_points") or 0.0)
        if projected <= 0 and game.stat is not None:
            projected = max(205.0, float(game.stat.points or 0))
        projected = max(205.0, projected)

        if market == "over_total_points":
            line = _clamp_half_line(projected, 205.0, 255.0)
            label = f"OVER {line:.1f} TOTAL POINTS"
            rationale = "Linha cheia no padrao de totais da casa para a partida inteira."
        elif market == "over_1q_points":
            line = _clamp_half_line(projected * 0.24, 52.0, 66.0)
            label = f"OVER {line:.1f} PONTOS 1 QUARTO"
            rationale = "Linha de 1Q ajustada para a faixa mais comum da Bet365."
        elif market == "over_1h_points":
            line = _clamp_half_line(projected * 0.49, 104.0, 132.0)
            label = f"OVER {line:.1f} PONTOS 1 TEMPO"
            rationale = "Linha de 1 tempo calibrada para o padrao usual da casa."
        elif market == "over_3q_points":
            line = _clamp_half_line(projected * 0.25, 50.0, 66.0)
            label = f"OVER {line:.1f} PONTOS 3 QUARTO"
            rationale = "Linha de 3Q ajustada para espelhar a oferta padrao da Bet365."
        elif market == "over_2h_points":
            line = _clamp_half_line(projected * 0.51, 102.0, 132.0)
            label = f"OVER {line:.1f} PONTOS 2 TEMPO"
            rationale = "Linha de 2 tempo calibrada para a faixa mais comum da casa."
        elif market == "live_over_total_points":
            current_total = float(live_context.get("home_score", 0) + live_context.get("away_score", 0))
            pace_projection = max(projected, current_total + 12.0)
            line = _clamp_half_line(pace_projection, 205.0, 260.0)
            label = f"AO VIVO OVER {line:.1f} TOTAL POINTS"
            rationale = "Linha ao vivo recalculada para ficar proxima da precificacao da casa."

    if sport == "football":
        projected_goals = float(sport_detail.get("projected_total_goals") or 1.8)

        if market == "over_2_5_goals":
            line = 2.5
            label = "OVER 2.5 GOLS"
            rationale = "Linha padrao de gols para o jogo inteiro."
        elif market == "over_1h_goals":
            line = _clamp_half_line(projected_goals * 0.45, 0.5, 1.5)
            label = f"OVER {line:.1f} GOLS 1 TEMPO"
            rationale = "Linha de 1 tempo ajustada para o mercado mais comum da casa."
        elif market == "over_2h_goals":
            line = _clamp_half_line(projected_goals * 0.55, 0.5, 1.5)
            label = f"OVER {line:.1f} GOLS 2 TEMPO"
            rationale = "Linha de 2 tempo calibrada para o padrao mais comum da casa."
        elif market == "live_next_goal":
            line = None
            label = "AO VIVO PROXIMO GOL"
            rationale = "Mercado ao vivo para proximo gol com leitura de estado do jogo."

    return {
        "name": market,
        "label": label,
        "line": line,
        "is_live_market": market.startswith("live_"),
        "rationale": rationale,
    }


def _build_advanced_analysis(game, market: str, probability: float, odd: float, ev: float, score: float, live_context: dict):
    manipulation = _manipulation_risk(game.id, market, odd, ev)
    data_quality = _data_quality(game)
    entry_score = _entry_score(ev, probability, manipulation["score"], data_quality["score"])
    tier = _entry_tier(entry_score)
    confidence = "alta" if entry_score >= 80 else "media" if entry_score >= 65 else "baixa"
    suggested_stake = _stake_for_tier(tier)

    pre_bet_checklist = {
        "ev_positive": ev > 0,
        "integrity_gate_ok": manipulation["nivel"] != "alto",
        "odds_in_range": 1.25 <= odd <= 6.5,
        "data_quality_ok": data_quality["grade"] in ["A", "B"],
    }

    checklist_ok = all(pre_bet_checklist.values())
    invalidation = "Cancelar entrada se odd mover >8% contra em ate 10 minutos do inicio."

    if game.sport == "basketball":
        sport_detail = _basketball_detail(_build_advanced_analysis.db, game)
    else:
        sport_detail = _football_detail(_build_advanced_analysis.db, game)

    market_metadata = _build_market_metadata(game, market, sport_detail, live_context)
    house_line = _bet365_reference_line(market, market_metadata["line"])
    line_edge = None
    if market_metadata["line"] is not None and house_line is not None:
        line_edge = round(float(house_line) - float(market_metadata["line"]), 2)
    edge_label = _value_edge_label(line_edge)
    reason = _decision_reason(entry_score, ev, line_edge, live_context, manipulation["nivel"])

    alerts = []
    if tier in ["entrada_principal", "entrada_moderada"] and checklist_ok:
        alerts.append("entrar_agora")
    if not pre_bet_checklist["ev_positive"]:
        alerts.append("cancelar_entrada")
    if manipulation["nivel"] == "alto":
        alerts.append("risco_integridade_alto")

    return {
        "source": "mvp_engine_v2",
        "integridade": {
            "risco_manipulacao": manipulation["nivel"],
            "score_risco": manipulation["score"],
            "alerta": manipulation["alerta"],
            "gate_block": manipulation["nivel"] == "alto",
        },
        "recomendacao": {
            "confianca": confidence,
            "sugestao_stake": suggested_stake,
            "resumo": f"{market_metadata['label']} com EV {ev:.3f} e odd {odd:.2f}.",
            "score_entrada": entry_score,
            "tier": tier,
            "invalidation_rule": invalidation,
        },
        "bankroll": _bankroll_rules(),
        "data_quality": data_quality,
        "checklist_pre_entrada": {
            "items": pre_bet_checklist,
            "aprovado": checklist_ok,
        },
        "sport_detail": sport_detail,
        "mercado": market_metadata,
        "comparativo_casa": {
            "sportsbook": "Bet365-reference",
            "linha_ia": market_metadata["line"],
            "linha_casa": house_line,
            "edge_linha": line_edge,
            "edge_classificacao": edge_label,
            "mercado_familia": _market_family(market),
        },
        "operacao": {
            "motivo_curto": reason,
            "janela": "ao_vivo" if live_context.get("is_live") else "pre_jogo",
            "sinal": "executar" if ev > 0 and entry_score >= 65 and manipulation["nivel"] != "alto" else "monitorar" if ev > 0 else "evitar",
        },
        "ao_vivo": live_context,
        "alertas_tempo_real": alerts,
        "pos_jogo": {
            "tracking_required": True,
            "fields": ["resultado_real", "roi_real", "desvio_ev", "motivo_saida"],
        },
        "governanca": {
            "motivo": f"score={entry_score}, ev={ev:.3f}, risco={manipulation['nivel']}",
            "risco": manipulation["nivel"],
            "stake": suggested_stake,
            "condicao_invalida": invalidation,
        },
        "contexto": {
            "sport": game.sport,
            "probabilidade": probability,
            "odd": odd,
            "ev": ev,
            "score": score,
        },
    }


# Atribuido dinamicamente no loop para evitar alterar assinatura da funcao.
_build_advanced_analysis.db = None


def generate_daily_predictions(db: Session):
    games = crud.get_today_games(db)
    created = []

    for game in games:
        live_context = fetch_live_context_for_match(
            sport_code=game.sport,
            home_team_name=game.home_team_rel.name if game.home_team_rel else "",
            away_team_name=game.away_team_rel.name if game.away_team_rel else "",
            match_utc_naive=game.date,
        )
        markets = MARKETS_BY_SPORT.get(game.sport, ["match_winner_home"])
        for market in markets:
            probability = _seed_probability(game.id, market)

            if market.startswith("live_") and not live_context.get("is_live"):
                probability = min(probability, 0.38)

            odd = _compute_odd(probability)
            ev = round((probability * odd) - 1.0, 4)
            score = round((probability * 0.6) + (max(ev, 0) * 0.4), 4)
            recommended = ev > 0
            _build_advanced_analysis.db = db
            analysis = _build_advanced_analysis(game, market, probability, odd, ev, score, live_context)

            pred = crud.save_or_update_prediction(
                db=db,
                match_id=game.id,
                market=market,
                probability=probability,
                odds=odd,
                ev=ev,
                score=score,
                recommended=recommended,
                analise_avancada=analysis,
            )
            created.append(pred)

    return created
