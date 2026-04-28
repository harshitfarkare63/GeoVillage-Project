#!/usr/bin/env python3
"""
GeoVillage API — MDDS Dataset ETL Pipeline
Handles Excel/CSV import → validation → normalization → batch upsert → integrity check
"""

import os
import logging
import hashlib
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

load_dotenv()

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
BATCH_SIZE = 5000
LOG_FILE = f"etl_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# REQUIRED COLUMNS IN INPUT FILE
# ─────────────────────────────────────────────
REQUIRED_COLUMNS = {
    "state_name", "state_code",
    "district_name",
    "subdistrict_name",
    "village_name",
}

# ─────────────────────────────────────────────
# STEP 1: LOAD FILE
# ─────────────────────────────────────────────
def load_file(filepath: str) -> pd.DataFrame:
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    log.info(f"Loading file: {filepath}")
    if path.suffix in [".xlsx", ".xls"]:
        df = pd.read_excel(filepath, dtype=str)
    elif path.suffix == ".csv":
        df = pd.read_csv(filepath, dtype=str, encoding="utf-8-sig")
    else:
        raise ValueError(f"Unsupported format: {path.suffix}. Use .xlsx or .csv")

    log.info(f"Loaded {len(df):,} rows with {len(df.columns)} columns")
    return df

# ─────────────────────────────────────────────
# STEP 2: VALIDATE SCHEMA
# ─────────────────────────────────────────────
def validate_schema(df: pd.DataFrame):
    cols = {c.lower().strip() for c in df.columns}
    missing = REQUIRED_COLUMNS - cols
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    log.info("Schema validation passed ✅")

# ─────────────────────────────────────────────
# STEP 3: CLEAN DATA
# ─────────────────────────────────────────────
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.lower().strip().replace(" ", "_") for c in df.columns]
    str_cols = df.select_dtypes(include="object").columns
    df[str_cols] = df[str_cols].apply(lambda x: x.str.strip().str.title())
    df.dropna(subset=["village_name", "subdistrict_name", "district_name", "state_name"], inplace=True)
    log.info(f"After cleaning: {len(df):,} rows remain")
    return df

# ─────────────────────────────────────────────
# STEP 4: DEDUPLICATE
# ─────────────────────────────────────────────
def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)
    df["_dedup_key"] = (
        df["village_name"] + "|" + df["subdistrict_name"] + "|" +
        df["district_name"] + "|" + df["state_name"]
    )
    df.drop_duplicates(subset=["_dedup_key"], inplace=True)
    df.drop(columns=["_dedup_key"], inplace=True)
    log.info(f"Deduplication removed {before - len(df):,} rows. {len(df):,} remain.")
    return df

# ─────────────────────────────────────────────
# STEP 5: BATCH INSERT WITH HIERARCHY MAPPING
# ─────────────────────────────────────────────
def import_to_db(df: pd.DataFrame):
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # ID caches to avoid repeated lookups
    country_id = _ensure_country(cur, "India", "IND")
    state_cache = {}
    district_cache = {}
    subdist_cache = {}

    success_count = 0
    error_count = 0

    chunks = [df.iloc[i:i+BATCH_SIZE] for i in range(0, len(df), BATCH_SIZE)]
    log.info(f"Processing {len(chunks)} batches of {BATCH_SIZE} rows...")

    village_batch = []

    for batch_num, chunk in enumerate(chunks, 1):
        log.info(f"Batch {batch_num}/{len(chunks)} — {len(chunk)} rows")
        try:
            for _, row in chunk.iterrows():
                try:
                    state_name = row["state_name"]
                    district_name = row["district_name"]
                    subdist_name = row["subdistrict_name"]
                    village_name = row["village_name"]
                    pincode = row.get("pincode", None)

                    # Upsert hierarchy
                    state_id = _ensure_state(cur, state_cache, state_name, row.get("state_code", ""), country_id)
                    dist_id = _ensure_district(cur, district_cache, district_name, state_id)
                    subdist_id = _ensure_subdistrict(cur, subdist_cache, subdist_name, dist_id)

                    village_batch.append((village_name, pincode, subdist_id))

                except Exception as row_err:
                    error_count += 1
                    log.warning(f"Row error: {row_err} | Row: {row.to_dict()}")

            # Batch insert villages
            if village_batch:
                execute_values(
                    cur,
                    """
                    INSERT INTO villages (name, pincode, "subDistrictId")
                    VALUES %s
                    ON CONFLICT DO NOTHING
                    """,
                    village_batch,
                )
                success_count += len(village_batch)
                village_batch = []

            conn.commit()
        except Exception as batch_err:
            conn.rollback()
            log.error(f"Batch {batch_num} failed: {batch_err}")
            error_count += len(chunk)

    cur.close()
    conn.close()
    log.info(f"\n✅ Import complete: {success_count:,} inserted, {error_count:,} errors")

# ─────────────────────────────────────────────
# HIERARCHY HELPERS (with caching)
# ─────────────────────────────────────────────
def _ensure_country(cur, name, code):
    cur.execute("INSERT INTO countries (name, code) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING RETURNING id", (name, code))
    cur.execute("SELECT id FROM countries WHERE code = %s", (code,))
    return cur.fetchone()[0]

def _ensure_state(cur, cache, name, code, country_id):
    key = f"{name}|{country_id}"
    if key in cache: return cache[key]
    cur.execute("""
        INSERT INTO states (name, code, "countryId") VALUES (%s, %s, %s)
        ON CONFLICT (code, "countryId") DO NOTHING
    """, (name, code or name[:5].upper(), country_id))
    cur.execute('SELECT id FROM states WHERE name = %s AND "countryId" = %s', (name, country_id))
    state_id = cur.fetchone()[0]
    cache[key] = state_id
    return state_id

def _ensure_district(cur, cache, name, state_id):
    key = f"{name}|{state_id}"
    if key in cache: return cache[key]
    cur.execute('INSERT INTO districts (name, "stateId") VALUES (%s, %s) ON CONFLICT DO NOTHING', (name, state_id))
    cur.execute('SELECT id FROM districts WHERE name = %s AND "stateId" = %s', (name, state_id))
    dist_id = cur.fetchone()[0]
    cache[key] = dist_id
    return dist_id

def _ensure_subdistrict(cur, cache, name, dist_id):
    key = f"{name}|{dist_id}"
    if key in cache: return cache[key]
    cur.execute('INSERT INTO sub_districts (name, "districtId") VALUES (%s, %s) ON CONFLICT DO NOTHING', (name, dist_id))
    cur.execute('SELECT id FROM sub_districts WHERE name = %s AND "districtId" = %s', (name, dist_id))
    subdist_id = cur.fetchone()[0]
    cache[key] = subdist_id
    return subdist_id

# ─────────────────────────────────────────────
# STEP 6: INTEGRITY VERIFICATION
# ─────────────────────────────────────────────
def verify_integrity():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    counts = {}
    for table in ["countries", "states", "districts", "sub_districts", "villages"]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        counts[table] = cur.fetchone()[0]
    cur.close()
    conn.close()
    log.info("\n📊 Database row counts:")
    for table, count in counts.items():
        log.info(f"  {table}: {count:,}")
    return counts

# ─────────────────────────────────────────────
# MAIN ENTRYPOINT
# ─────────────────────────────────────────────
def run_pipeline(filepath: str):
    log.info("=" * 60)
    log.info("🚀 GeoVillage ETL Pipeline Started")
    log.info("=" * 60)

    df = load_file(filepath)
    validate_schema(df)
    df = clean_data(df)
    df = deduplicate(df)
    import_to_db(df)
    verify_integrity()

    log.info("=" * 60)
    log.info("✅ Pipeline completed successfully")
    log.info(f"📄 Log saved to: {LOG_FILE}")
    log.info("=" * 60)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python etl_pipeline.py <path-to-dataset.xlsx>")
        sys.exit(1)
    run_pipeline(sys.argv[1])
