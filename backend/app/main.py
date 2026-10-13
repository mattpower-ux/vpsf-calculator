from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import get_db, init_db
from app.scoring.store import ModelUnavailableError, load_published
from app.routers import admin, articles, help, integrations, leads, products, properties, scoring, tracking

settings = get_settings()
default_cors_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
    "https://vpsf-calculator.onrender.com",
    "https://vpsf-frontend.onrender.com",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([*settings.cors_origins, *default_cors_origins])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(properties.router)
app.include_router(scoring.router)
app.include_router(products.router)
app.include_router(leads.router)
app.include_router(admin.router)
app.include_router(integrations.router)
app.include_router(tracking.router)
app.include_router(articles.router)
app.include_router(help.router)


@app.get("/api/health")
async def health(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        version = load_published(db).version
    except ModelUnavailableError as error:
        raise HTTPException(status_code=503, detail="Scoring model unavailable") from error
    return {"status": "ok", "modelVersion": version}
