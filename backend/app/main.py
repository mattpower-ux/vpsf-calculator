from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import admin, integrations, leads, products, properties, scoring

settings = get_settings()
default_cors_origins = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
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


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "modelVersion": settings.model_version}
