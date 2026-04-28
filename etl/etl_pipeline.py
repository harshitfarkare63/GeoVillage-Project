#!/usr/bin/env python3
"""
GeoVillage API — MDDS Dataset ETL Pipeline
Supports official MDDS Excel format with columns:
  MDDS STC, STATE NAME, MDDS DTC, DISTRICT,
  MDDS SUB_DT, SUB DISTRICT NAME, MDDS PLCN, AREA NAME
"""

import os
import sys
import logging
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
BATCH_SIZE   = 5000
LOG_FILE     = f"etl_run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

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
# MDDS COLUMN MAPPING → internal names
# Maps your Excel headers → what the pipeline uses internally
# ─────────────────────────────────────────────
COLUMN_MAP = {
    # MDDS official column name  : internal name
    "mdds stc"        : "state_code",
    "state name"      : "state_name",
    "mdds dtc"        : "district_code",
    "district"        : "district_name",
    "mdds sub_dt"     : "subdistrict_code",
    "sub district name": "subdistrict_name",
    "mdds plcn"       : "village_code",
    "area name"       : "village_name",

    # Also handle common alternative spellings
    "state"           : "state_name",
    "district name"   : "district_name",
    "sub_district"    : "subdistrict_name",
    "subdistrict"     : "subdistrict_name",
    "village"         : "village_name",
    "village name"    : "village_name",
    "place name"      : "village_name",
    "pincode"         : "pincode",
    "pin code"        : "pincode",
    "pin"             : "pincode",
}

REQUIRED_INTERNAL = {"state_name", "district_name", "subdistrict_name", "village_name"}

# ─────────────────────────────────────────────
# STEP 1: LOAD FILE
# ─────────────────────────────────────────────
def load_file(filepath: str) -> pd.DataFrame:
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {filepath}")

    log.info(f"Loading: {filepath}")
    if path.suffix in [".xlsx", ".xls"]:
        df = pd.read_excel(filepath, dtype=str)
    elif path.suffix == ".csv":
        df = pd.read_csv(filepath, dtype=str, encoding="utf-8-sig")
    else:
        raise ValueError(f"Unsupported format: {path.suffix}. Use .xlsx or .csv")

    log.info(f"Loaded {len(df):,} rows | Columns: {list(df.columns)}")
    return df

# ─────────────────────────────────────────────
# STEP 2: MAP MDDS COLUMNS → internal names
# ─────────────────────────────────────────────
def map_columns(df: pd.DataFrame) -> pd.DataFrame:
    # Normalize column names: lowercase + strip spaces
    df.columns = [c.lower().strip() for c in df.columns]

    log.info(f"Detected columns: {list(df.columns)}")

    rename = {}
    for col in df.columns:
        if col in COLUMN_MAP:
            rename[col] = COLUMN_MAP[col]

    df = df.rename(columns=rename)
    log.info(f"Mapped columns: {rename}")

    # Check required columns exist after mapping
    missing = REQUIRED_INTERNAL - set(df.columns)
    if missing:
        log.error(f"\n❌ Missing required columns after mapping: {missing}")
        log.error(f"   Your Excel columns (lowercased): {list(df.columns)}")
        log.error("   Add the missing columns to your file or update COLUMN_MAP in this script.")
        sys.exit(1)

    log.info("Column mapping ✅")
    return df

# ─────────────────────────────────────────────
# STEP 3: CLEAN DATA
# ─────────────────────────────────────────────
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    # Drop rows missing any key field
    df = df.dropna(subset=["state_name", "district_name", "subdistrict_name", "village_name"])

    # Title-case string columns, strip whitespace
    for col in ["state_name", "district_name", "subdistrict_name", "village_name"]:
        df[col] = df[col].str.strip().str.title()

    # Codes: uppercase, strip
    for col in ["state_code", "district_code", "subdistrict_code", "village_code"]:
        if col in df.columns:
            df[col] = df[col].str.strip().str.upper()

    # Pincode: digits only, max 6 chars
    if "pincode" in df.columns:
        df["pincode"] = df["pincode"].str.extract(r"(\d{5,6})")[0]

    log.info(f"After cleaning: {len(df):,} rows remain")
    return df

# ─────────────────────────────────────────────
# STEP 4: DEDUPLICATE
# ─────────────────────────────────────────────
def deduplicate(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)
    df["_key"] = (
        df["village_name"] + "|" +
        df["subdistrict_name"] + "|" +
        df["district_name"] + "|" +
        df["state_name"]
    )
    df = df.drop_duplicates(subset=["_key"]).drop(columns=["_key"])
    log.info(f"Deduplication: removed {before - len(df):,} duplicates | {len(df):,} remain")
    return df

# ─────────────────────────────────────────────
# STEP 5: INSERT INTO DATABASE
# ─────────────────────────────────────────────
def import_to_db(df: pd.DataFrame):
    log.info(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()

    country_id    = _ensure_country(cur, "India", "IND")
    conn.commit()

    state_cache   = {}
    district_cache = {}
    subdist_cache  = {}

    success_count = 0
    error_count   = 0
    village_batch = []

    total_rows = len(df)
    chunks = [df.iloc[i:i + BATCH_SIZE] for i in range(0, total_rows, BATCH_SIZE)]
    log.info(f"Processing {len(chunks)} batches of up to {BATCH_SIZE} rows each...")

    for batch_num, chunk in enumerate(chunks, 1):
        log.info(f"  Batch {batch_num}/{len(chunks)} — {len(chunk)} rows")
        try:
            for _, row in chunk.iterrows():
                try:
                    state_name    = row["state_name"]
                    district_name = row["district_name"]
                    subdist_name  = row["subdistrict_name"]
                    village_name  = row["village_name"]
                    state_code    = row.get("state_code", state_name[:5].upper()) if "state_code" in row else state_name[:5].upper()
                    pincode       = row.get("pincode", None) if "pincode" in row else None
                    if pd.isna(pincode): pincode = None

                    state_id   = _ensure_state(cur, state_cache, state_name, state_code, country_id)
                    dist_id    = _ensure_district(cur, district_cache, district_name, state_id)
                    subdist_id = _ensure_subdistrict(cur, subdist_cache, subdist_name, dist_id)

                    village_batch.append((village_name, pincode, subdist_id))

                except Exception as row_err:
                    error_count += 1
                    log.warning(f"  Row skipped: {row_err}")

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
            log.error(f"  Batch {batch_num} failed and rolled back: {batch_err}")
            error_count += len(chunk)

    cur.close()
    conn.close()
    log.info(f"\n✅ Import done: {success_count:,} villages inserted | {error_count:,} errors")

# ─────────────────────────────────────────────
# HIERARCHY HELPERS (cached upserts)
# ─────────────────────────────────────────────
def _ensure_country(cur, name, code):
    cur.execute(
        "INSERT INTO countries (name, code) VALUES (%s, %s) ON CONFLICT (code) DO NOTHING",
        (name, code)
    )
    cur.execute("SELECT id FROM countries WHERE code = %s", (code,))
    return cur.fetchone()[0]

def _ensure_state(cur, cache, name, code, country_id):
    key = f"{name}|{country_id}"
    if key in cache:
        return cache[key]
    cur.execute(
        'INSERT INTO states (name, code, "countryId") VALUES (%s, %s, %s) ON CONFLICT (code, "countryId") DO NOTHING',
        (name, code, country_id)
    )
    cur.execute('SELECT id FROM states WHERE name = %s AND "countryId" = %s', (name, country_id))
    row = cur.fetchone()
    cache[key] = row[0]
    return row[0]

def _ensure_district(cur, cache, name, state_id):
    key = f"{name}|{state_id}"
    if key in cache:
        return cache[key]
    cur.execute(
        'INSERT INTO districts (name, "stateId") VALUES (%s, %s) ON CONFLICT DO NOTHING',
        (name, state_id)
    )
    cur.execute('SELECT id FROM districts WHERE name = %s AND "stateId" = %s', (name, state_id))
    row = cur.fetchone()
    cache[key] = row[0]
    return row[0]

def _ensure_subdistrict(cur, cache, name, dist_id):
    key = f"{name}|{dist_id}"
    if key in cache:
        return cache[key]
    cur.execute(
        'INSERT INTO sub_districts (name, "districtId") VALUES (%s, %s) ON CONFLICT DO NOTHING',
        (name, dist_id)
    )
    cur.execute('SELECT id FROM sub_districts WHERE name = %s AND "districtId" = %s', (name, dist_id))
    row = cur.fetchone()
    cache[key] = row[0]
    return row[0]

# ─────────────────────────────────────────────
# STEP 6: VERIFY ROW COUNTS
# ─────────────────────────────────────────────
def verify_integrity():
    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor()
    log.info("\n📊 Database row counts:")
    for table in ["countries", "states", "districts", "sub_districts", "villages"]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        log.info(f"   {table:20s}: {count:>10,}")
    cur.close()
    conn.close()

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def run_pipeline(filepath: str):
    log.info("=" * 60)
    log.info("🚀 GeoVillage MDDS ETL Pipeline")
    log.info("=" * 60)

    df = load_file(filepath)
    df = map_columns(df)
    df = clean_data(df)
    df = deduplicate(df)
    import_to_db(df)
    verify_integrity()

    log.info("=" * 60)
    log.info("✅ Pipeline completed")
    log.info(f"📄 Log saved to: {LOG_FILE}")
    log.info("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\nUsage:  python etl_pipeline.py <path-to-dataset.xlsx>")
        print("Example: python etl_pipeline.py mdds_villages.xlsx\n")
        sys.exit(1)
    run_pipeline(sys.argv[1])
