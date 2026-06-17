from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional
import httpx
import json
import os

from database import get_db
from models import Project, VoiceLog, User
from auth import require_auth

router = APIRouter(prefix="/api", tags=["parse"])

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = "mistral-large-latest"


class ParseRequest(BaseModel):
    text: str
    entry_date: Optional[date] = None


def build_prompt(text: str, projects: list[dict], today: str, job_context: str) -> str:
    project_list = json.dumps(projects, ensure_ascii=False, indent=2)
    return f"""Du bist ein intelligenter Zeiterfassungs-Assistent für eine Fachkraft im Bereich "{job_context}".

Deine Aufgabe: Extrahiere strukturierte Arbeitszeitbuchungen aus dem folgenden Freitext (Deutsch).

Kontext:
- Benutzer-Rolle: {job_context}
- Datum heute: {today}
- Die Beschreibungen sollen kurz, professionell und kundentauglich formuliert sein (geeignet für Stundenzettel / Leistungsnachweise)
- Typische Tätigkeiten im Bereich "{job_context}" beachten (z.B. bei SAP: Customizing, Workshops, Go-Live-Support, Konzeption, Testing, Schulung etc.)

Bekannte Projekte (id, name, shortcode, aliases):
{project_list}

Regeln:
1. Extrahiere ALLE erwähnten Projektzeitbuchungen.
2. Ordne jede Erwähnung dem besten passenden Projekt zu (Fuzzy-Matching: Abkürzungen, Tippfehler, Aliase).
3. Konfidenz >= 0.8 → project_id setzen. Darunter → project_id: null + new_project_suggestions Eintrag.
4. Stundenangaben: "halbe Stunde" = 0.5, "anderthalb" = 1.5, "Viertel" = 0.25, "dreiviertel" = 0.75.
5. Kein Datum im Text → heutiges Datum verwenden: {today}.
6. Beschreibung: professionell, prägnant, auf Deutsch, kundentauglich (max. 60 Zeichen). Keine Umgangssprache.

Antworte NUR mit gültigem JSON:
{{
  "date": "YYYY-MM-DD",
  "total_hours": 8.0,
  "entries": [
    {{
      "project_id": 3,
      "project_name": "ZIM",
      "hours": 0.5,
      "description": "Abstimmungsgespräch Projektteam",
      "confidence": 0.95
    }}
  ],
  "new_project_suggestions": [
    {{ "detected_name": "Müller AG", "entry_index": 2 }}
  ]
}}

Eingabetext:
"{text}"
"""


@router.post("/parse-voice")
async def parse_voice(req: ParseRequest, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if not MISTRAL_API_KEY:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    projects = db.query(Project).filter(Project.active == True).all()
    project_list = [
        {"id": p.id, "name": p.name, "shortcode": p.shortcode, "aliases": json.loads(p.aliases or "[]")}
        for p in projects
    ]

    today = (req.entry_date or date.today()).isoformat()
    prompt = build_prompt(req.text, project_list, today, user.job_context or "SAP Berater")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
                json={
                    "model": MISTRAL_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Mistral API error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Mistral connection error: {str(e)}")

    content = response.json()["choices"][0]["message"]["content"]
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Mistral returned invalid JSON")

    log = VoiceLog(
        date=date.fromisoformat(parsed.get("date", today)),
        raw_text=req.text,
        parsed_json=json.dumps(parsed),
    )
    db.add(log)
    db.commit()

    return parsed
