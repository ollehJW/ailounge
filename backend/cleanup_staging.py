from __future__ import annotations

import argparse
import json
import logging
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_STAGING_DIR = BASE_DIR / "staging" / "assets"
DEFAULT_MAX_AGE_DAYS = 7


def parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("updated_at is missing")

    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def is_asset_id(value: str) -> bool:
    try:
        return str(uuid.UUID(value)) == value.lower()
    except ValueError:
        return False


def cleanup_staging(
    staging_dir: Path,
    max_age_days: int = DEFAULT_MAX_AGE_DAYS,
    *,
    dry_run: bool = False,
    now: datetime | None = None,
) -> tuple[int, int]:
    reference_time = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    cutoff = reference_time - timedelta(days=max_age_days)
    removed_count = 0
    skipped_count = 0

    if not staging_dir.exists():
        logging.info("Staging directory does not exist: %s", staging_dir)
        return removed_count, skipped_count

    for asset_dir in sorted(staging_dir.iterdir()):
        if asset_dir.is_symlink() or not asset_dir.is_dir() or not is_asset_id(asset_dir.name):
            logging.warning("Skipping unexpected staging entry: %s", asset_dir)
            skipped_count += 1
            continue

        meta_path = asset_dir / "meta.json"
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            if not isinstance(meta, dict):
                raise ValueError("meta.json root must be an object")
            updated_at = parse_timestamp(meta.get("updated_at"))
        except (OSError, json.JSONDecodeError, ValueError) as error:
            logging.warning("Skipping %s: %s", asset_dir.name, error)
            skipped_count += 1
            continue

        if updated_at > cutoff:
            continue

        if dry_run:
            logging.info("Would remove %s (updated_at=%s)", asset_dir, updated_at.isoformat())
        else:
            shutil.rmtree(asset_dir)
            logging.info("Removed %s (updated_at=%s)", asset_dir, updated_at.isoformat())
        removed_count += 1

    return removed_count, skipped_count


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove expired AI asset staging directories.")
    parser.add_argument("--staging-dir", type=Path, default=DEFAULT_STAGING_DIR)
    parser.add_argument("--max-age-days", type=int, default=DEFAULT_MAX_AGE_DAYS)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.max_age_days < 1:
        parser.error("--max-age-days must be at least 1")
    return args


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    removed_count, skipped_count = cleanup_staging(
        args.staging_dir,
        args.max_age_days,
        dry_run=args.dry_run,
    )
    logging.info("Cleanup finished: removed=%d skipped=%d", removed_count, skipped_count)


if __name__ == "__main__":
    main()
