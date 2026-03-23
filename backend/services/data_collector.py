import json
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from urllib.request import urlopen

from sqlalchemy.orm import Session

import crud
import models

APP_TIMEZONE = os.getenv("APP_TIMEZONE", "America/Sao_Paulo")
ESPN_TIMEOUT_SECONDS = float(os.getenv("ESPN_TIMEOUT_SECONDS", "20"))

ESPN_SOURCES = [
    ("basketball", "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"),
    ("football", "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard"),
    ("football", "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard"),
    ("football", "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard"),
    ("football", "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard"),
]

ESPN_BASE_BY_SPORT = {
    "basketball": [url for sport, url in ESPN_SOURCES if sport == "basketball"],
    "football": [url for sport, url in ESPN_SOURCES if sport == "football"],
}


def _empty_stats():
    return {
        "goals": 0,
        "corners": 0,
        "shots": 0,
        "shots_on_target": 0,
        "cards": 0,
        "points": 0,
    }


def _parse_espn_datetime(raw_date: str) -> datetime | None:
    if not raw_date:
        return None
    try:
        normalized = raw_date.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


def _is_same_local_day(utc_naive_dt: datetime, local_date: date, app_tz: ZoneInfo) -> bool:
    local_dt = utc_naive_dt.replace(tzinfo=timezone.utc).astimezone(app_tz)
    return local_dt.date() == local_date


def _fetch_espn_events(base_url: str, day: date):
    day_str = day.strftime("%Y%m%d")
    url = f"{base_url}?dates={day_str}"
    with urlopen(url, timeout=ESPN_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload.get("events") or []


def _extract_teams(event: dict):
    competitions = event.get("competitions") or []
    if not competitions:
        return None

    competitors = competitions[0].get("competitors") or []
    home_name = None
    away_name = None
    home_score = 0
    away_score = 0

    for competitor in competitors:
        team = competitor.get("team") or {}
        name = team.get("displayName") or team.get("name")
        if not name:
            continue

        score_raw = competitor.get("score")
        try:
            score_value = int(score_raw) if score_raw is not None else 0
        except (TypeError, ValueError):
            score_value = 0

        if competitor.get("homeAway") == "home":
            home_name = name
            home_score = score_value
        elif competitor.get("homeAway") == "away":
            away_name = name
            away_score = score_value

    if not home_name or not away_name:
        return None

    return home_name.strip(), away_name.strip(), home_score, away_score


def _normalize_espn_games(events: list[dict], sport_code: str, local_date: date, app_tz: ZoneInfo):
    normalized = []
    for event in events:
        event_datetime = _parse_espn_datetime(event.get("date", ""))
        if event_datetime is None:
            continue
        if not _is_same_local_day(event_datetime, local_date, app_tz):
            continue

        teams = _extract_teams(event)
        if not teams:
            continue

        home_team, away_team, home_score, away_score = teams
        stats = _empty_stats()
        if sport_code == "football":
            stats["goals"] = home_score + away_score
        elif sport_code == "basketball":
            stats["points"] = home_score + away_score

        normalized.append(
            {
                "home_team": home_team,
                "away_team": away_team,
                "date": event_datetime,
                "sport": sport_code,
                "stats": stats,
            }
        )

    return normalized


def _extract_live_snapshot(event: dict):
    competitions = event.get("competitions") or []
    if not competitions:
        return None

    competitors = competitions[0].get("competitors") or []
    home_score = 0
    away_score = 0

    for competitor in competitors:
        score_raw = competitor.get("score")
        try:
            score_value = int(score_raw) if score_raw is not None else 0
        except (TypeError, ValueError):
            score_value = 0

        if competitor.get("homeAway") == "home":
            home_score = score_value
        elif competitor.get("homeAway") == "away":
            away_score = score_value

    status = event.get("status") or {}
    status_type = status.get("type") or {}

    state = str(status_type.get("state") or "")
    short_detail = str(status_type.get("shortDetail") or status_type.get("detail") or "")
    period = int(status.get("period") or 0)
    clock = str(status.get("displayClock") or "")

    return {
        "is_live": state == "in",
        "status": state,
        "status_text": short_detail,
        "period": period,
        "clock": clock,
        "home_score": home_score,
        "away_score": away_score,
    }


def fetch_live_context_for_match(sport_code: str, home_team_name: str, away_team_name: str, match_utc_naive: datetime):
    app_tz = ZoneInfo(APP_TIMEZONE)
    local_day = match_utc_naive.replace(tzinfo=timezone.utc).astimezone(app_tz).date()

    base_urls = ESPN_BASE_BY_SPORT.get(sport_code, [])
    home_key = (home_team_name or "").strip().lower()
    away_key = (away_team_name or "").strip().lower()

    for base_url in base_urls:
        for day in [local_day - timedelta(days=1), local_day, local_day + timedelta(days=1)]:
            try:
                events = _fetch_espn_events(base_url, day)
            except Exception:
                continue

            for event in events:
                teams = _extract_teams(event)
                if not teams:
                    continue

                home, away, _, _ = teams
                if home.strip().lower() == home_key and away.strip().lower() == away_key:
                    snapshot = _extract_live_snapshot(event)
                    if snapshot:
                        return snapshot

    return {
        "is_live": False,
        "status": "scheduled",
        "status_text": "Aguardando inicio",
        "period": 0,
        "clock": "",
        "home_score": 0,
        "away_score": 0,
    }


def update_games_from_source(db: Session):
    app_tz = ZoneInfo(APP_TIMEZONE)
    local_today = datetime.now(app_tz).date()

    start_local = datetime.combine(local_today, datetime.min.time(), tzinfo=app_tz)
    end_local = start_local + timedelta(days=1)
    start_day = start_local.astimezone(timezone.utc).replace(tzinfo=None)
    end_day = end_local.astimezone(timezone.utc).replace(tzinfo=None)

    existing_today = (
        db.query(models.Match)
        .filter(
            models.Match.date >= start_day,
            models.Match.date < end_day,
            models.Match.sport.in_(["football", "basketball"]),
        )
        .all()
    )

    for match in existing_today:
        db.delete(match)
    db.commit()

    games = []
    days_to_pull = [local_today - timedelta(days=1), local_today, local_today + timedelta(days=1)]
    for sport_code, base_url in ESPN_SOURCES:
        for day in days_to_pull:
            try:
                events = _fetch_espn_events(base_url, day)
                games.extend(_normalize_espn_games(events, sport_code, local_today, app_tz))
            except Exception:
                pass

    unique_games = {}
    for game in games:
        key = (game["sport"], game["home_team"], game["away_team"], game["date"])
        unique_games[key] = game
    games = list(unique_games.values())

    created = []
    for game in games:
        home = crud.get_or_create_team(db, game["home_team"], game["sport"])
        away = crud.get_or_create_team(db, game["away_team"], game["sport"])
        match = crud.create_match_with_stats(
            db,
            home_team_id=home.id,
            away_team_id=away.id,
            date=game["date"],
            sport=game["sport"],
            stats_payload=game["stats"],
        )
        created.append(match)

    return created
