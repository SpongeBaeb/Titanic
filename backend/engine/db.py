import os
import json
import uuid
import sqlite3
from supabase import create_client, Client

SUPABASE_URL = "https://bfbqxhzcodhwzynjfcjt.supabase.co"
SUPABASE_KEY = "sb_publishable_H0ZtD0fXJADwBP9eswkTjw_2HHbtMvu"

try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    USE_SUPABASE = True
except Exception as e:
    print(f"Supabase init error: {e}")
    USE_SUPABASE = False

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
