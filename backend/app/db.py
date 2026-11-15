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

    backup_before_advice_schema()
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    ensure_lead_schema()
    from app.scoring.store import seed_published

    with SessionLocal() as db:
        seed_published(db)
        from app.eco_tips import seed_tips
        seed_tips(db)


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


def backup_before_advice_schema():
    """One-time consistent SQLite backup before additive production tables."""
    import os
    import sqlite3
    if not os.getenv("RENDER") or not settings.database_url.startswith("sqlite"):
        return
    path = make_url(settings.database_url).database
    if not path or not Path(path).exists() or "eco_tips" in inspect(engine).get_table_names():
        return
    backup = Path(path).with_name("vpsf-before-advice-2026-11-09.sqlite.bak")
    if backup.exists():
        return
    with sqlite3.connect(path) as source, sqlite3.connect(str(backup)) as target:
        source.backup(target)


def ensure_lead_schema(bind=None) -> None:
    """Add columns/indexes only; retain legacy contact data and unknown consent.

    PostgreSQL gets a transaction advisory lock; SQLite serializes migration with
    BEGIN IMMEDIATE. No destructive table rebuild or consent backfill is used.
    """
    from sqlalchemy.schema import CreateColumn
    from app.models import LeadRecord
    bind = bind or engine
    backup_before_lead_schema(bind)
    with bind.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(789236104)"))
        elif connection.dialect.name == "sqlite":
            connection.exec_driver_sql("BEGIN IMMEDIATE")
        inspector = inspect(connection)
        if "leads" not in inspector.get_table_names():
            return
        existing = {column["name"] for column in inspector.get_columns("leads")}
        for column in LeadRecord.__table__.columns:
            if column.name not in existing:
                definition = str(CreateColumn(column).compile(dialect=connection.dialect))
                connection.execute(text("ALTER TABLE leads ADD COLUMN " + definition))
        for index in LeadRecord.__table__.indexes:
            index.create(bind=connection, checkfirst=True)
        connection.execute(text("UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL"))


def backup_before_lead_schema(bind=None) -> None:
    """Publish one complete, consistent pre-migration SQLite snapshot on Render.

    A temporary sibling plus atomic link avoids treating a partial backup as
    complete or overwriting the first backup during concurrent worker startup.
    Failure aborts migration, leaving the original database unchanged.
    """
    import os
    import sqlite3
    import tempfile
    from contextlib import closing
    from app.models import LeadRecord

    bind = bind or engine
    if not os.getenv("RENDER") or bind.dialect.name != "sqlite":
        return
    database = bind.url.database
    if not database or database == ":memory:":
        return
    path = Path(database).resolve()
    if not path.is_file():
        return
    backup = path.with_name("vpsf-before-leads-2026-11-15.sqlite.bak")
    if backup.exists():
        return
    inspector = inspect(bind)
    if "leads" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("leads")}
    if set(LeadRecord.__table__.columns.keys()) <= existing:
        return
    handle, temporary_name = tempfile.mkstemp(prefix=".vpsf-leads-backup-", suffix=".tmp", dir=path.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as source:
            with closing(sqlite3.connect(str(temporary))) as target:
                source.backup(target)
        # Ensure database bytes are durable before the final filename is visible.
        with temporary.open("rb+") as contents:
            os.fsync(contents.fileno())
        try:
            os.link(temporary, backup)
        except FileExistsError:
            pass  # Another worker already published the one-time snapshot.
    finally:
        temporary.unlink(missing_ok=True)
