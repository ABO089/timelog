from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routers import entries, projects, parse
from routers import auth_router

Base.metadata.create_all(bind=engine)

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
