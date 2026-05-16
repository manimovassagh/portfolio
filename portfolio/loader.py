"""Load Trade Republic CSV exports into a normalized DataFrame."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

EXPORTS_DIR = Path(__file__).resolve().parent.parent / "exports"

NUMERIC_COLS = ["shares", "price", "amount", "fee", "tax", "fx_rate"]


def latest_export(exports_dir: Path = EXPORTS_DIR) -> Path | None:
    """Return the most recent CSV in exports/, or None if none exist."""
    csvs = sorted(exports_dir.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
    return csvs[0] if csvs else None


def list_exports(exports_dir: Path = EXPORTS_DIR) -> list[Path]:
    """All CSVs in exports/, newest first."""
    return sorted(exports_dir.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)


def load(csv_path: Path) -> pd.DataFrame:
    """Read a Trade Republic export and normalize types."""
    df = pd.read_csv(csv_path, dtype=str).fillna("")

    for col in NUMERIC_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["datetime"] = pd.to_datetime(df["datetime"], utc=True, errors="coerce")
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    df = df.sort_values("datetime").reset_index(drop=True)
    return df
