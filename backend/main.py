from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routers import entries, projects, parse
from routers import auth_router

Base.metadata.create_all(bind=engine)

# Safe column migrations — add new columns without dropping data
def run_migrations():
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE users ADD COLUMN job_context VARCHAR DEFAULT 'SAP Berater'",
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


@app.get("/health")
def health():
    return {"status": "ok"}
