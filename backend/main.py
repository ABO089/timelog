import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import engine, SessionLocal
from models import Base
from routers import entries, projects, parse, auth_router
from routers import push_router, improve, transcribe

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

TZ = ZoneInfo("Europe/Berlin")


def run_migrations():
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE users ADD COLUMN job_context VARCHAR DEFAULT 'SAP Berater'",
        "ALTER TABLE users ADD COLUMN notify_time VARCHAR DEFAULT '16:30'",
        "ALTER TABLE users ADD COLUMN notify_enabled BOOLEAN DEFAULT 0",
        "ALTER TABLE users ADD COLUMN push_subscription TEXT",
        "ALTER TABLE projects ADD COLUMN billing_type VARCHAR DEFAULT 'fakturierbar'",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column already exists


run_migrations()

app = FastAPI(title="TimeLog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(projects.router)
app.include_router(entries.router)
app.include_router(parse.router)
app.include_router(push_router.router)
app.include_router(improve.router)
app.include_router(transcribe.router)

scheduler = AsyncIOScheduler(timezone=TZ)


async def send_daily_reminders():
    now = datetime.now(TZ)
    current_hhmm = now.strftime("%H:%M")
    db = SessionLocal()
    try:
        from models import User
        from push import send_push_to_user
        users = db.query(User).filter(
            User.notify_enabled == True,
            User.notify_time == current_hhmm,
            User.push_subscription != None,
        ).all()
        for user in users:
            await send_push_to_user(user, db, body="Nicht vergessen: Arbeitszeiten eintragen! 📋")
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    # Ensure VAPID keys exist
    db = SessionLocal()
    try:
        from push import ensure_vapid_keys
        ensure_vapid_keys(db)
    finally:
        db.close()

    scheduler.add_job(send_daily_reminders, CronTrigger(minute="*"), id="daily_reminders", replace_existing=True)
    scheduler.start()
    logger.info("Scheduler started — checking reminders every minute")


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()


@app.get("/health")
def health():
    return {"status": "ok"}
