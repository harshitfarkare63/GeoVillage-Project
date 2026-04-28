#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GeoVillage -- Batch ETL Runner
Processes all 30 state MDDS files (xls/ods) into NeonDB.
Run: python run_all_states.py
"""

import os, sys, io, logging
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from pathlib import Path
from datetime import datetime

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Load .env from backend folder
_env = Path(__file__).parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=_env)
print(f"Using .env: {_env}")

# ─── CONFIG ───────────────────────────────────────────────
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
BATCH_SIZE   = 5000
LOG_FILE     = f"batch_etl_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ─── ALL 30 STATE FILES ───────────────────────────────────
FILES = [
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_32_KERALA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_02_HIMACHAL_PRADESH.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_10_BIHAR.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_11_SIKKIM.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_16_TRIPURA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_17_MEGHALAYA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_23_MADHYA_PRADESH.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_26_DADRA_and_NAGAR_HAVELI.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_24_GUJARAT.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_28_ANDHRA_PRADESH.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_12_ARUNACHAL_PRADESH.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_20_JHARKHAND.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_29_KARNATAKA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_31_LAKSHADWEEP.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_34_PUDUCHERRY.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_35_ANDAMAN_and_NICOBAR_ISLANDS.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_03_PUNJAB.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_06_HARYANA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_13_NAGALAND.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_21_ODISHA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_22_CHHATTISGARH.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_25_DAMAN_and_DIU.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_33_TAMIL_NADU.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_08_RAJASTHAN.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_09_UTTAR_PRADESH.ods",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_15_MIZORAM.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_18_ASSAM.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_19_WEST_BENGAL.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_27_MAHARASHTRA.xls",
    r"C:\Users\Dell\Downloads\villages\dataset\Rdir_2011_30_GOA.xls",
]

# ─── COLUMN MAP (covers all MDDS variants seen in the files) ──
# Keys are lowercased column names from the Excel files
COLUMN_MAP = {
    # State
    "mdds stc"          : "state_code",
    "state name"        : "state_name",
    "state"             : "state_name",
    # District  (some files say "DISTRICT", others "DISTRICT NAME")
    "mdds dtc"          : "district_code",
    "district"          : "district_name",
    "district name"     : "district_name",
    # Sub-district  ("SUB DISTRICT NAME" or "SUB-DISTRICT NAME")
    "mdds sub_dt"       : "subdistrict_code",
    "sub district name" : "subdistrict_name",
    "sub-district name" : "subdistrict_name",
    "subdistrict name"  : "subdistrict_name",
    "sub_district name" : "subdistrict_name",
    "subdistrict"       : "subdistrict_name",
    # Village  ("AREA NAME" or "Area Name")
    "mdds plcn"         : "village_code",
    "area name"         : "village_name",
    "village name"      : "village_name",
    "village"           : "village_name",
    "place name"        : "village_name",
    # Pincode (optional)
    "pincode"           : "pincode",
    "pin code"          : "pincode",
}

REQUIRED = {"state_name", "district_name", "subdistrict_name", "village_name"}

# ─── LOAD ONE FILE ───────────────────────────────────────
def load_file(path: str) -> pd.DataFrame:
    p = Path(path)
    suffix = p.suffix.lower()
    if suffix in [".xlsx", ".xls"]:
        df = pd.read_excel(path, dtype=str)
    elif suffix == ".ods":
        df = pd.read_excel(path, dtype=str, engine="odf")
    elif suffix == ".csv":
        df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
    else:
        raise ValueError(f"Unsupported format: {suffix}")
    log.info(f"  Loaded {len(df):,} rows | Cols: {list(df.columns)}")
    return df

# ─── MAP + CLEAN ──────────────────────────────────────────
def prepare(df: pd.DataFrame, fname: str):
    # Normalize: lowercase + strip
    df.columns = [c.lower().strip() for c in df.columns]
    log.info(f"  Raw columns: {list(df.columns)}")

    # Rename
    rename = {c: COLUMN_MAP[c] for c in df.columns if c in COLUMN_MAP}
    df = df.rename(columns=rename)

    # Check required
    missing = REQUIRED - set(df.columns)
    if missing:
        log.error(f"  SKIP {fname} - missing after mapping: {missing}")
        log.error(f"  Mapped cols: {list(df.columns)}")
        return None

    # Drop empty required rows
    df = df.dropna(subset=list(REQUIRED))

    # Clean text
    for col in ["state_name", "district_name", "subdistrict_name", "village_name"]:
        df[col] = df[col].astype(str).str.strip().str.title()

    for col in ["state_code", "district_code", "subdistrict_code"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper()

    if "pincode" in df.columns:
        df["pincode"] = df["pincode"].astype(str).str.extract(r"(\d{5,6})")[0]

    # Deduplicate
    before = len(df)
    df["_key"] = (df["village_name"] + "|" + df["subdistrict_name"] + "|" +
                  df["district_name"] + "|" + df["state_name"])
    df = df.drop_duplicates(subset=["_key"]).drop(columns=["_key"])
    log.info(f"  After clean+dedup: {len(df):,} rows ({before - len(df):,} removed)")
    return df

# ─── DB HELPERS ───────────────────────────────────────────
_country_id     = None
_state_cache    = {}
_district_cache = {}
_subdist_cache  = {}

def get_country(cur):
    global _country_id
    if _country_id:
        return _country_id
    cur.execute("INSERT INTO countries (name, code) VALUES ('India','IND') ON CONFLICT (code) DO NOTHING")
    cur.execute("SELECT id FROM countries WHERE code='IND'")
    _country_id = cur.fetchone()[0]
    return _country_id

def get_state(cur, name, code, country_id):
    key = f"{name}|{country_id}"
    if key in _state_cache:
        return _state_cache[key]
    # Ensure code is unique by appending hash if needed
    safe_code = (str(code)[:5] if code and str(code) != "nan" else name[:5]).upper()
    cur.execute(
        'INSERT INTO states (name, code, "countryId") VALUES (%s,%s,%s) '
        'ON CONFLICT (code, "countryId") DO UPDATE SET name=EXCLUDED.name',
        (name, safe_code, country_id)
    )
    cur.execute('SELECT id FROM states WHERE name=%s AND "countryId"=%s', (name, country_id))
    row = cur.fetchone()
    _state_cache[key] = row[0]
    return row[0]

def get_district(cur, name, state_id):
    key = f"{name}|{state_id}"
    if key in _district_cache:
        return _district_cache[key]
    cur.execute(
        'INSERT INTO districts (name, "stateId") VALUES (%s,%s) ON CONFLICT DO NOTHING',
        (name, state_id)
    )
    cur.execute('SELECT id FROM districts WHERE name=%s AND "stateId"=%s', (name, state_id))
    _district_cache[key] = cur.fetchone()[0]
    return _district_cache[key]

def get_subdist(cur, name, dist_id):
    key = f"{name}|{dist_id}"
    if key in _subdist_cache:
        return _subdist_cache[key]
    cur.execute(
        'INSERT INTO sub_districts (name, "districtId") VALUES (%s,%s) ON CONFLICT DO NOTHING',
        (name, dist_id)
    )
    cur.execute('SELECT id FROM sub_districts WHERE name=%s AND "districtId"=%s', (name, dist_id))
    _subdist_cache[key] = cur.fetchone()[0]
    return _subdist_cache[key]

# ─── INSERT ONE STATE ─────────────────────────────────────
def insert_df(df: pd.DataFrame, conn) -> tuple:
    cur = conn.cursor()
    country_id = get_country(cur)
    conn.commit()

    success, errors, batch = 0, 0, []
    chunks = [df.iloc[i:i+BATCH_SIZE] for i in range(0, len(df), BATCH_SIZE)]

    for idx, chunk in enumerate(chunks, 1):
        try:
            for _, row in chunk.iterrows():
                try:
                    state_code = str(row.get("state_code", "")).strip()
                    sid  = get_state(cur, row["state_name"], state_code, country_id)
                    did  = get_district(cur, row["district_name"], sid)
                    sdid = get_subdist(cur, row["subdistrict_name"], did)
                    pin  = row.get("pincode", None)
                    if pd.isna(pin) if pin is not None else False:
                        pin = None
                    batch.append((row["village_name"], pin, sdid))
                except Exception as e:
                    errors += 1

            if batch:
                execute_values(
                    cur,
                    'INSERT INTO villages (name, pincode, "subDistrictId") VALUES %s ON CONFLICT DO NOTHING',
                    batch
                )
                success += len(batch)
                batch = []
            conn.commit()
            log.info(f"    Batch {idx}/{len(chunks)} done")

        except Exception as e:
            conn.rollback()
            log.error(f"    Batch {idx} failed: {e}")
            errors += len(chunk)

    cur.close()
    return success, errors

# ─── FINAL COUNTS ─────────────────────────────────────────
def verify(conn):
    cur = conn.cursor()
    log.info("\nDatabase row counts:")
    log.info(f"  {'Table':<25} {'Rows':>12}")
    log.info(f"  {'-'*38}")
    for table in ["countries", "states", "districts", "sub_districts", "villages"]:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        log.info(f"  {table:<25} {cur.fetchone()[0]:>12,}")
    cur.close()

# ─── MAIN ─────────────────────────────────────────────────
def main():
    log.info("=" * 60)
    log.info("GeoVillage Batch ETL -- All States")
    log.info(f"Files: {len(FILES)}")
    log.info("=" * 60)

    if not DATABASE_URL:
        log.error("DATABASE_URL not set in backend/.env")
        sys.exit(1)

    log.info(f"Connecting to NeonDB...")
    conn = psycopg2.connect(DATABASE_URL)
    log.info("Connected OK")

    total_inserted, total_errors = 0, 0
    failed = []

    for i, filepath in enumerate(FILES, 1):
        fname = Path(filepath).name
        log.info(f"\n[{i}/{len(FILES)}] {fname}")

        try:
            df = load_file(filepath)
            df = prepare(df, fname)
            if df is None:
                failed.append(fname)
                continue
            inserted, errors = insert_df(df, conn)
            total_inserted  += inserted
            total_errors    += errors
            log.info(f"  => Inserted: {inserted:,} | Errors: {errors:,}")

        except FileNotFoundError:
            log.error(f"  File not found: {filepath}")
            failed.append(fname)
        except Exception as e:
            log.error(f"  FAILED: {e}")
            failed.append(fname)

    verify(conn)
    conn.close()

    log.info("\n" + "=" * 60)
    log.info("Batch complete!")
    log.info(f"  Total inserted : {total_inserted:,}")
    log.info(f"  Total errors   : {total_errors:,}")
    log.info(f"  Failed files   : {len(failed)}")
    for f in failed:
        log.info(f"    FAILED: {f}")
    log.info(f"  Log saved to   : {LOG_FILE}")
    log.info("=" * 60)

if __name__ == "__main__":
    main()
