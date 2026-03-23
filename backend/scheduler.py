from apscheduler.schedulers.background import BackgroundScheduler

from database import SessionLocal
from services.data_collector import update_games_from_source
from services.prediction_engine import generate_daily_predictions

scheduler = BackgroundScheduler()


def _refresh_games_job():
    db = SessionLocal()
    try:
        update_games_from_source(db)
        generate_daily_predictions(db)
    finally:
        db.close()


def start_scheduler():
    if scheduler.running:
        return

    scheduler.add_job(_refresh_games_job, "interval", hours=1, id="refresh_games", replace_existing=True)
    scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
