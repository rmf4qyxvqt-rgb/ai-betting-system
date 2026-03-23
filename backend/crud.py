from datetime import datetime, timedelta
import os
from zoneinfo import ZoneInfo
from sqlalchemy import and_, not_
from sqlalchemy.orm import Session, joinedload
import models

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Sao_Paulo")


def get_or_create_team(db: Session, name: str, sport: str) -> models.Team:
    team = db.query(models.Team).filter(models.Team.name == name).first()
    if team:
        return team

    team = models.Team(name=name, sport=sport)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


def create_match_with_stats(
    db: Session,
    home_team_id: int,
    away_team_id: int,
    date: datetime,
    sport: str,
    stats_payload: dict,
) -> models.Match:
    existing = (
        db.query(models.Match)
        .filter(
            models.Match.home_team == home_team_id,
            models.Match.away_team == away_team_id,
            models.Match.date == date,
            models.Match.sport == sport,
        )
        .first()
    )
    if existing:
        if existing.stat is None:
            db.add(models.Stat(match_id=existing.id, **stats_payload))
            db.commit()
        return existing

    match = models.Match(
        home_team=home_team_id,
        away_team=away_team_id,
        date=date,
        sport=sport,
    )
    db.add(match)
    db.commit()
    db.refresh(match)

    stat = models.Stat(match_id=match.id, **stats_payload)
    db.add(stat)
    db.commit()
    db.refresh(match)
    return match


def get_today_games(db: Session):
    app_tz = ZoneInfo(APP_TIMEZONE)
    local_today = datetime.now(app_tz).date()
    start_local = datetime.combine(local_today, datetime.min.time(), tzinfo=app_tz)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    end_utc = end_local.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

    return (
        db.query(models.Match)
        .options(
            joinedload(models.Match.home_team_rel),
            joinedload(models.Match.away_team_rel),
            joinedload(models.Match.stat),
        )
        .filter(
            and_(
                models.Match.date >= start_utc,
                models.Match.date < end_utc,
                not_(models.Match.home_team_rel.has(models.Team.name.like("Time Global%"))),
                not_(models.Match.away_team_rel.has(models.Team.name.like("Time Global%"))),
            )
        )
        .order_by(models.Match.date.asc())
        .all()
    )


def get_all_matches_with_stats(db: Session):
    return (
        db.query(models.Match)
        .options(
            joinedload(models.Match.home_team_rel),
            joinedload(models.Match.away_team_rel),
            joinedload(models.Match.stat),
        )
        .all()
    )


def save_or_update_prediction(
    db: Session,
    match_id: int,
    market: str,
    probability: float,
    odds: float,
    ev: float,
    score: float,
    recommended: bool,
    analise_avancada: dict | None = None,
):
    pred = (
        db.query(models.Prediction)
        .filter(models.Prediction.match_id == match_id, models.Prediction.market == market)
        .first()
    )

    if pred:
        pred.probability = probability
        pred.odds = odds
        pred.ev = ev
        pred.score = score
        pred.recommended = recommended
        pred.analise_avancada = analise_avancada
    else:
        pred = models.Prediction(
            match_id=match_id,
            market=market,
            probability=probability,
            odds=odds,
            ev=ev,
            score=score,
            recommended=recommended,
            analise_avancada=analise_avancada,
        )
        db.add(pred)

    db.commit()
    db.refresh(pred)
    return pred


def get_predictions(db: Session, recommended_only: bool = True, match_id: int | None = None):
    query = (
        db.query(models.Prediction)
        .join(models.Match, models.Prediction.match_id == models.Match.id)
        .join(models.Team, models.Match.home_team == models.Team.id)
        .options(
            joinedload(models.Prediction.match).joinedload(models.Match.home_team_rel),
            joinedload(models.Prediction.match).joinedload(models.Match.away_team_rel),
        )
        .order_by(models.Prediction.score.desc())
    )
    if match_id is not None:
        query = query.filter(models.Prediction.match_id == match_id)
    if recommended_only:
        query = query.filter(models.Prediction.ev > 0)
    return query.all()


def get_match_by_id(db: Session, match_id: int):
    return (
        db.query(models.Match)
        .options(
            joinedload(models.Match.home_team_rel),
            joinedload(models.Match.away_team_rel),
            joinedload(models.Match.stat),
        )
        .filter(models.Match.id == match_id)
        .first()
    )


def get_recent_team_matches(
    db: Session,
    team_id: int,
    sport: str,
    before_date: datetime,
    limit: int = 10,
):
    return (
        db.query(models.Match)
        .options(joinedload(models.Match.stat))
        .filter(
            models.Match.sport == sport,
            models.Match.date < before_date,
            (
                (models.Match.home_team == team_id)
                | (models.Match.away_team == team_id)
            ),
        )
        .order_by(models.Match.date.desc())
        .limit(limit)
        .all()
    )
