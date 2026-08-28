"""Import product catalog rows from a CSV file.

Expected columns:
id,brand,product,pillar,category,weight,summary,image_url,source_year,source_issue
"""

import csv
import sys
from pathlib import Path

from app.db import SessionLocal, init_db
from app.models import ProductRecord


def import_csv(path: Path) -> int:
    init_db()
    count = 0
    with SessionLocal() as db, path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            record = db.get(ProductRecord, row["id"]) or ProductRecord(id=row["id"])
            record.brand = row["brand"]
            record.product = row["product"]
            record.manufacturer = row.get("manufacturer") or row["brand"]
            record.pillar = row["pillar"]
            record.category = row["category"]
            record.weight = row.get("weight") or "Standard"
            record.summary = row.get("summary") or ""
            record.image_url = row.get("image_url") or None
            record.source_year = int(row["source_year"]) if row.get("source_year") else None
            record.source_issue = row.get("source_issue") or None
            db.add(record)
            count += 1
        db.commit()
    return count


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python backend/scripts/seed_products_from_csv.py path/to/products.csv")
    imported = import_csv(Path(sys.argv[1]))
    print(f"Imported {imported} products")
