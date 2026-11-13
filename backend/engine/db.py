import os
import json
import uuid
import sqlite3
from supabase import create_client, Client

# 접속 정보는 코드에 두지 않고 환경 변수로 받는다 (backend/.env.example 참고)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

supabase: Client | None = None
USE_SUPABASE = False

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        USE_SUPABASE = True
    except Exception as e:
        print(f"Supabase init error: {e}")
else:
    print("SUPABASE_URL / SUPABASE_KEY 환경 변수가 없어 SQLite만 사용합니다.")

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'results.db')

def init_local_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quiz_results (
            id TEXT PRIMARY KEY,
            statistical_probability REAL,
            adjusted_probability REAL,
            persona TEXT,
            historical_match TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_local_db()

# ── 장면 도달 기록 ──────────────────────────────────────────────
# 어느 장면에서 사람들이 떠나는지 보기 위한 익명 기록이다. 개인 정보는 받지 않는다:
# sid 는 탭마다 새로 만드는 무작위 값이고, 장면 이름과 고른 값, 걸린 시간만 남긴다.
# Supabase 에 scene_events 테이블이 있으면 거기에, 없으면 SQLite 에 쌓는다.
#   create table scene_events (id bigserial primary key, sid text, run int, kind text, scene text, value text, ms int, created_at timestamptz default now());
def _init_events():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS scene_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sid TEXT, run INTEGER, kind TEXT, scene TEXT, value TEXT, ms INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_scene_events_scene ON scene_events (scene, kind)')
    conn.commit()
    conn.close()

_init_events()
_events_remote = USE_SUPABASE

def save_events(rows):
    """rows: [{sid, run, kind, scene, value, ms}]"""
    global _events_remote
    if _events_remote:
        try:
            supabase.table("scene_events").insert(rows).execute()
            return
        except Exception as e:
            print(f"scene_events 를 Supabase 에 쓰지 못해 SQLite 로 바꿉니다: {e}")
            _events_remote = False
    conn = sqlite3.connect(DB_PATH)
    conn.executemany('INSERT INTO scene_events (sid, run, kind, scene, value, ms) VALUES (?, ?, ?, ?, ?, ?)',
                     [(r["sid"], r["run"], r["kind"], r["scene"], r["value"], r["ms"]) for r in rows])
    conn.commit()
    conn.close()

def funnel(first_run_only=True):
    """장면마다 도달한 사람 수(서로 다른 sid)와 고른 값의 분포."""
    rows = None
    if _events_remote:
        try:
            q = supabase.table("scene_events").select("sid,run,kind,scene,value").limit(200000)
            if first_run_only:
                q = q.eq("run", 1)
            rows = [(r["sid"], r["kind"], r["scene"], r.get("value")) for r in q.execute().data]
        except Exception as e:
            print(f"scene_events 를 Supabase 에서 읽지 못했습니다: {e}")
    if rows is None:
        conn = sqlite3.connect(DB_PATH)
        sql = 'SELECT sid, kind, scene, value FROM scene_events' + (' WHERE run = 1' if first_run_only else '')
        rows = conn.execute(sql).fetchall()
        conn.close()
    reached, picks = {}, {}
    for sid, kind, scene, value in rows:
        if kind == 'enter':
            reached.setdefault(scene, set()).add(sid)
        elif kind == 'pick':
            picks.setdefault(scene, {})
            picks[scene][value] = picks[scene].get(value, 0) + 1
    return {"reached": {k: len(v) for k, v in reached.items()}, "picks": picks}

def save_result(stat_prob, adj_prob, persona, historical_match):
    result_id = str(uuid.uuid4())
    match_json = json.dumps(historical_match)
    
    # Try Supabase first
    if USE_SUPABASE:
        try:
            data = {
                "id": result_id,
                "statistical_probability": stat_prob,
                "adjusted_probability": adj_prob,
                "persona": persona,
                "historical_match": match_json  # Stored as string or JSON, safely use string for compatibility if not JSONB
            }
            supabase.table("quiz_results").insert(data).execute()
            print("Successfully saved to Supabase")
            return result_id
        except Exception as e:
            print(f"Supabase insert error (likely table doesn't exist or RLS policy): {e}. Falling back to SQLite.")
            
    # Fallback to SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO quiz_results (id, statistical_probability, adjusted_probability, persona, historical_match)
        VALUES (?, ?, ?, ?, ?)
    ''', (result_id, stat_prob, adj_prob, persona, match_json))
    conn.commit()
    conn.close()
    print("Saved to SQLite fallback")
    
    return result_id

def get_result(result_id):
    if USE_SUPABASE:
        try:
            response = supabase.table("quiz_results").select("*").eq("id", result_id).execute()
            if response.data and len(response.data) > 0:
                row = response.data[0]
                hm = row.get("historical_match")
                if isinstance(hm, str):
                    hm = json.loads(hm)
                    
                return {
                    "id": row.get("id"),
                    "statistical_probability": row.get("statistical_probability"),
                    "adjusted_probability": row.get("adjusted_probability"),
                    "persona": row.get("persona"),
                    "historical_match": hm
                }
        except Exception as e:
            print(f"Supabase select error: {e}. Falling back to SQLite.")
            
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT statistical_probability, adjusted_probability, persona, historical_match FROM quiz_results WHERE id = ?', (result_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "id": result_id,
            "statistical_probability": row[0],
            "adjusted_probability": row[1],
            "persona": row[2],
            "historical_match": json.loads(row[3])
        }
    return None
