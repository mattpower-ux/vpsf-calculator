"""Prepare award photos without cropping, padding, or changing their content.

Run after build_award_catalog.py. Successful unchanged sources are cached in the
report; failures and changed URLs are retried on every run. Uses Pillow + stdlib.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import warnings

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "backend/app/data/award_products.json"
OUTPUT = ROOT / "frontend/public/catalog-images"
REPORT = ROOT / "docs/research/product-awards/images-report.json"
WORKERS = 6
TIMEOUT = 20
MAX_BYTES = 15 * 1024 * 1024
SIZE = (640, 480)
QUALITY = 78
ATTEMPTS = 3
SETTINGS = {"maxWidth": SIZE[0], "maxHeight": SIZE[1], "quality": QUALITY, "format": "webp"}


def require_https(url):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Image source and redirects must use HTTPS without credentials")


class HTTPSRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        require_https(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url):
    require_https(url)
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; AwardCatalogImagePreparation/1.0)", "Accept": "image/*"})
    deadline = time.monotonic() + TIMEOUT
    with build_opener(HTTPSRedirects()).open(request, timeout=TIMEOUT) as response:
        require_https(response.url)
        length = response.headers.get("Content-Length")
        if length and int(length) > MAX_BYTES:
            raise ValueError("Source exceeds 15 MiB download limit")
        data = bytearray()
        while True:
            if time.monotonic() >= deadline:
                raise TimeoutError("Download exceeded 20 second deadline")
            chunk = response.read(min(65536, MAX_BYTES + 1 - len(data)))
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > MAX_BYTES:
                raise ValueError("Source exceeds 15 MiB download limit")
        return bytes(data)


def encode(data):
    # Reject decompression bombs rather than allowing unexpectedly large decodes.
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(BytesIO(data)) as source:
            if getattr(source, "is_animated", False):
                raise ValueError("Animated source requires editorial review; not flattened")
            picture = ImageOps.exif_transpose(source)
            picture.thumbnail(SIZE, Image.Resampling.LANCZOS)
            mode = "RGBA" if "A" in picture.getbands() or "transparency" in picture.info else "RGB"
            picture = picture.convert(mode)
            output = BytesIO()
            picture.save(output, format="WEBP", quality=QUALITY, method=6,
                         **({"icc_profile": source.info["icc_profile"]} if source.info.get("icc_profile") else {}))
            return output.getvalue(), picture.size


def prepare(product, previous):
    identifier = product["id"]
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier):
        raise ValueError(f"Unsafe product id: {identifier!r}")
    url = product.get("imageSourceUrl", "")
    source_hash = sha256(url.encode("utf-8")).hexdigest()
    target = OUTPUT / f"{identifier}.webp"
    result = {"id": identifier, "sourceUrlHash": source_hash}
    if previous.get("sourceUrlHash") == source_hash and previous.get("status") == "ok" and target.is_file():
        data = target.read_bytes()
        if sha256(data).hexdigest() == previous.get("assetSha256"):
            return {**previous, "cached": True}
    error = ""
    for attempt in range(1, ATTEMPTS + 1):
        try:
            data = download(url)
            encoded, dimensions = encode(data)
            temporary = target.with_suffix(".webp.tmp")
            temporary.write_bytes(encoded)
            temporary.replace(target)
            return {**result, "status": "ok", "cached": False, "attempts": attempt,
                    "sourceBytes": len(data), "bytes": len(encoded),
                    "width": dimensions[0], "height": dimensions[1],
                    "assetSha256": sha256(encoded).hexdigest()}
        except (OSError, ValueError, TimeoutError, URLError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            error = f"{type(exc).__name__}: {exc}"[:300]
            # Decode/size/HTTPS errors cannot be fixed by fetching identical bytes.
            if isinstance(exc, (ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning)):
                break
            if isinstance(exc, HTTPError) and exc.code not in {408, 429, 500, 502, 503, 504}:
                break
            if attempt < ATTEMPTS:
                time.sleep(attempt)
    return {**result, "status": "failed", "cached": False, "attempts": attempt,
            "sourceUrl": url, "error": error, "previousAssetRetained": target.is_file()}


def main():
    products = json.loads(MANIFEST.read_text(encoding="utf-8-sig"))["products"]
    ids = [p["id"] for p in products]
    if len(ids) != len(set(ids)) or any(not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", i) for i in ids):
        raise ValueError("Manifest IDs must be unique safe filename slugs")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    old_report = json.loads(REPORT.read_text(encoding="utf-8")) if REPORT.exists() else {}
    previous = {r["id"]: r for r in old_report.get("images", [])} if old_report.get("settings") == SETTINGS else {}
    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(prepare, p, previous.get(p["id"], {})): p["id"] for p in products}
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            print(f"{len(results)}/{len(products)} {result['status']} {result['id']}" + (" (cached)" if result["cached"] else ""), flush=True)
    results.sort(key=lambda r: r["id"])
    success = [r for r in results if r["status"] == "ok"]
    report = {"generatedAt": datetime.now(timezone.utc).isoformat(), "settings": SETTINGS,
              "count": len(results), "succeeded": len(success), "failed": len(results) - len(success),
              "cached": sum(r["cached"] for r in results), "totalBytes": sum(r["bytes"] for r in success),
              "images": results}
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    temporary = REPORT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(report, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(REPORT)
    print(json.dumps({k: v for k, v in report.items() if k != "images"}), flush=True)
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
