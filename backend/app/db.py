from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def ensure_sqlite_parent_dir(database_url: str) -> None:
    if not database_url.startswith("sqlite"):
        return

    database_path = make_url(database_url).database
    if not database_path or database_path == ":memory:":
        return

    Path(database_path).expanduser().parent.mkdir(parents=True, exist_ok=True)


ensure_sqlite_parent_dir(settings.database_url)
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()


def ensure_runtime_schema() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "property_queries" not in table_names:
        return

    existing_columns = {column["name"] for column in inspector.get_columns("property_queries")}
    required_columns = {
        "vpsf_score": "INTEGER",
        "score_label": "VARCHAR(80)",
        "score_run_id": "INTEGER",
        "lead_name": "VARCHAR(255)",
        "lead_email": "VARCHAR(255)",
        "lead_product_id": "VARCHAR(120)",
        "lead_action": "VARCHAR(120)",
        "address_key": "VARCHAR(500)",
    }
    with engine.begin() as connection:
        for name, column_type in required_columns.items():
            if name not in existing_columns:
                connection.execute(text(f"ALTER TABLE property_queries ADD COLUMN {name} {column_type}"))

    if "api_usage" in table_names:
        api_usage_columns = {column["name"] for column in inspector.get_columns("api_usage")}
        if "limit_notified_at" not in api_usage_columns:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE api_usage ADD COLUMN limit_notified_at DATETIME"))

    if "educational_content" in table_names:
        educational_columns = {column["name"] for column in inspector.get_columns("educational_content")}
        required_educational_columns = {
            "background": "TEXT",
            "how_it_works": "JSON",
            "sustainable_aspects": "JSON",
        }
        with engine.begin() as connection:
            for name, column_type in required_educational_columns.items():
                if name not in educational_columns:
                    connection.execute(text(f"ALTER TABLE educational_content ADD COLUMN {name} {column_type}"))

    if "property_detail_archive" not in table_names:
        from app.models import PropertyDetailArchiveRecord

        PropertyDetailArchiveRecord.__table__.create(bind=engine, checkfirst=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
