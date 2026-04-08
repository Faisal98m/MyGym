import sqlite3
import os

DB_PATH = os.environ.get("DB_PATH", "tracker.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS programme (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week INTEGER NOT NULL,
            day_key TEXT NOT NULL,
            exercise TEXT NOT NULL,
            sets INTEGER NOT NULL,
            reps INTEGER,
            weight REAL,
            unit TEXT,
            note TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            day_key TEXT NOT NULL,
            exercise TEXT NOT NULL,
            set_num INTEGER NOT NULL,
            reps INTEGER,
            weight REAL,
            done INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()

def seed_programme():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM programme")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    week1 = [
        ("day1", "back squat",                4, 6,  80.0,  "kg",      None),
        ("day1", "RDL",                        3, 10, 80.0,  "kg",      "superset: leg curl 3x12"),
        ("day1", "bulgarian split squats",     3, 10, 16.0,  "kg DBs",  "each side"),
        ("day1", "plank",                      3, None, None, "50s",    "superset: dead bug 3x8 each side"),

        ("day2", "chest press machine",        4, 6,  120.0, "kg total", None),
        ("day2", "T-bar bent-over row",        4, 6,  100.0, "kg",       None),
        ("day2", "DB shoulder press",          3, 6,  30.0,  "kg",       None),
        ("day2", "machine lat pulldown",       3, 10, 80.0,  "kg",       None),
        ("day2", "tricep pushdown",            3, 12, 28.0,  "kg",       "superset: hammer curl 3x12"),

        ("day4", "deadlift",                   4, 5,  120.0, "kg",       None),
        ("day4", "leg press",                  3, 10, 100.0, "kg",       None),
        ("day4", "nordic hamstring curl",      3, 10, 42.0,  "kg",       None),
        ("day4", "kettlebell clean and press", 3, 5,  20.0,  "kg",       "each side"),
        ("day4", "kettlebell swings",          3, 8,  20.0,  "kg",       None),
        ("day4", "suitcase carry",             3, None, 20.0, "kg",      "20m each side"),

        ("day5", "pull-ups",                   5, 5,  None,  "BW",       "chase 3x10"),
        ("day5", "dips",                       3, 8,  None,  "BW",       None),
        ("day5", "machine lat pulldown",       3, 10, 80.0,  "kg",       None),
        ("day5", "cable fly",                  4, 8,  40.0,  "kg",       None),
        ("day5", "face pull",                  3, 20, 18.0,  "kg",       None),
        ("day5", "cable T-bar curl",           4, 10, 26.0,  "kg",       None),
    ]

    for row in week1:
        c.execute("""
            INSERT INTO programme (week, day_key, exercise, sets, reps, weight, unit, note)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        """, (row[0], row[1], row[2], row[3], row[4], row[5], row[6]))

    conn.commit()
    conn.close()
