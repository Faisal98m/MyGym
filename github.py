import os
import base64
import json
from datetime import datetime
import urllib.request
import urllib.error

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_REPO  = os.environ.get("GITHUB_REPO")   # e.g. "faisal/obsidian-vault"
GITHUB_BRANCH = os.environ.get("GITHUB_BRANCH", "main")
VAULT_FOLDER = os.environ.get("VAULT_FOLDER", "gym")

def push_session_to_github(date, day_key, day_label, exercises):
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return {"ok": False, "error": "GITHUB_TOKEN or GITHUB_REPO not set"}

    md = _build_markdown(date, day_label, exercises)
    filename = f"{date}-{day_key}-gym.md"
    path = f"{VAULT_FOLDER}/{filename}"

    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{path}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Content-Type": "application/json",
        "Accept": "application/vnd.github+json"
    }

    sha = _get_existing_sha(url, headers)

    payload = {
        "message": f"gym: log {date} {day_key}",
        "content": base64.b64encode(md.encode()).decode(),
        "branch": GITHUB_BRANCH
    }
    if sha:
        payload["sha"] = sha

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers=headers,
        method="PUT"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return {"ok": True, "filename": filename}
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": e.read().decode()}

def _get_existing_sha(url, headers):
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return data.get("sha")
    except:
        return None

def _build_markdown(date, day_label, exercises):
    lines = [
        f"# {day_label}",
        f"date: {date}",
        f"tags: gym training",
        ""
    ]
    for ex in exercises:
        lines.append(f"## {ex['exercise']}")
        for s in ex["sets"]:
            reps = s.get("reps") or "—"
            weight = s.get("weight") or "BW"
            done = "✓" if s.get("done") else "○"
            lines.append(f"- set {s['set_num']}: {reps} reps × {weight} {done}")
        lines.append("")
    return "\n".join(lines)
