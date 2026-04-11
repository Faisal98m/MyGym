from flask import Blueprint, jsonify, request
from datetime import date as dt_date
from db import get_db
from github import push_session_to_github

bp = Blueprint("main", __name__)

DAY_LABELS = {
    "day1": "day 1 — lower, squat",
    "day2": "day 2 — upper, push/pull",
    "day3": "day 3 — rest",
    "day4": "day 4 — lower, hinge",
    "day5": "day 5 — upper, vertical + arms",
    "day6": "day 6 — rest",
    "day7": "day 7 — rest",
}

@bp.route("/")
def index():
    from flask import render_template
    return render_template("index.html")

@bp.route("/api/programme/<day_key>", methods=["GET"])
def get_programme(day_key):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM programme WHERE day_key = ? ORDER BY id",
        (day_key,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@bp.route("/api/programme/<int:exercise_id>", methods=["PATCH"])
def update_programme(exercise_id):
    data = request.get_json()
    allowed = {"sets", "reps", "weight"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        return jsonify({"error": "nothing to update"}), 400
    conn = get_db()
    for col, val in updates.items():
        conn.execute(f"UPDATE programme SET {col} = ? WHERE id = ?", (val, exercise_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/session/<day_key>", methods=["GET"])
def get_session(day_key):
    today = str(dt_date.today())
    date = request.args.get("date", today)
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sessions WHERE date = ? AND day_key = ? ORDER BY exercise, set_num",
        (date, day_key)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@bp.route("/api/session/set", methods=["POST"])
def log_set():
    data = request.get_json()
    required = ["date", "day_key", "exercise", "set_num"]
    if not all(k in data for k in required):
        return jsonify({"error": "missing fields"}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM sessions WHERE date=? AND day_key=? AND exercise=? AND set_num=?",
        (data["date"], data["day_key"], data["exercise"], data["set_num"])
    ).fetchone()

    if existing:
        conn.execute(
            "UPDATE sessions SET reps=?, weight=?, done=? WHERE id=?",
            (data.get("reps"), data.get("weight"), int(data.get("done", 0)), existing["id"])
        )
    else:
        conn.execute(
            "INSERT INTO sessions (date, day_key, exercise, set_num, reps, weight, done) VALUES (?,?,?,?,?,?,?)",
            (data["date"], data["day_key"], data["exercise"], data["set_num"],
             data.get("reps"), data.get("weight"), int(data.get("done", 0)))
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

@bp.route("/api/session/complete", methods=["POST"])
def complete_session():
    data = request.get_json()
    date = data.get("date")
    day_key = data.get("day_key")
    if not date or not day_key:
        return jsonify({"error": "missing date or day_key"}), 400

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM sessions WHERE date=? AND day_key=? ORDER BY exercise, set_num",
        (date, day_key)
    ).fetchall()
    conn.close()

    exercises = {}
    for r in rows:
        ex = r["exercise"]
        if ex not in exercises:
            exercises[ex] = []
        exercises[ex].append(dict(r))

    payload = [{"exercise": ex, "sets": sets} for ex, sets in exercises.items()]
    label = DAY_LABELS.get(day_key, day_key)
    result = push_session_to_github(date, day_key, label, payload)

    _check_adaptations(date, day_key, conn=get_db())

    return jsonify(result)

@bp.route("/api/history", methods=["GET"])
def get_history():
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT date, day_key FROM sessions ORDER BY date DESC"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

def _check_adaptations(date, day_key, conn):
    programme = conn.execute(
        "SELECT * FROM programme WHERE day_key = ?", (day_key,)
    ).fetchall()
    suggestions = []
    for ex in programme:
        if not ex["weight"]:
            continue
        sets = conn.execute(
            "SELECT * FROM sessions WHERE date=? AND day_key=? AND exercise=? AND done=1",
            (date, day_key, ex["exercise"])
        ).fetchall()
        if not sets:
            continue
        beat = sum(
            1 for s in sets
            if (s["reps"] and s["reps"] > (ex["reps"] or 0))
            or (s["weight"] and s["weight"] > ex["weight"])
        )
        if beat >= max(1, round(len(sets) * 0.6)):
            suggestions.append({
                "exercise": ex["exercise"],
                "current_weight": ex["weight"],
                "suggested_weight": ex["weight"] + 2.5,
                "programme_id": ex["id"]
            })
    conn.close()
    return suggestions

@bp.route("/api/adapt/<day_key>", methods=["GET"])
def get_adaptations(day_key):
    today = str(dt_date.today())
    date = request.args.get("date", today)
    conn = get_db()
    suggestions = _check_adaptations(date, day_key, conn)
    return jsonify(suggestions)

@bp.route("/api/adapt/accept", methods=["POST"])
def accept_adaptation():
    data = request.get_json()
    prog_id = data.get("programme_id")
    new_weight = data.get("new_weight")
    if not prog_id or new_weight is None:
        return jsonify({"error": "missing fields"}), 400
    conn = get_db()
    conn.execute("UPDATE programme SET weight=? WHERE id=?", (new_weight, prog_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})

