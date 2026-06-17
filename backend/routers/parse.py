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

router = APIRouter(prefix="/api", tags=["parse"], dependencies=[Depends(require_auth)])

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = "mistral-large-latest"


class ParseRequest(BaseModel):
    text: str
    entry_date: Optional[date] = None


def build_prompt(text: str, projects: list[dict], today: str) -> str:
    project_list = json.dumps(projects, ensure_ascii=False, indent=2)
    return f"""Du bist ein Assistent für einen SAP-Berater, der Arbeitszeiteinträge aus gesprochener Sprache (Deutsch) extrahiert.

Heute ist: {today}

Bekannte Projekte (id, name, shortcode, aliases):
{project_list}

Aufgabe:
1. Extrahiere alle erwähnten Projektzeitbuchungen aus dem folgenden Text.
2. Ordne jede erkannte Projekt-Erwähnung dem besten passenden Projekt aus der Liste zu (Fuzzy-Matching: Abkürzungen, Tippfehler, Aliase).
3. Wenn die Übereinstimmung >= 80% Konfidenz hat, setze project_id auf die ID des passenden Projekts.
4. Wenn kein Projekt gefunden wird oder Konfidenz < 80%, setze project_id auf null und füge das erkannte Projekt zu new_project_suggestions hinzu.
5. Stunden können als Dezimalzahl angegeben sein ("eine halbe Stunde" = 0.5, "anderthalb" = 1.5, "zwei Stunden" = 2.0).
6. Wenn kein Datum erwähnt wird, nimm das heutige Datum: {today}.

Antworte NUR mit gültigem JSON in diesem exakten Format:
{{
  "date": "YYYY-MM-DD",
  "total_hours": 8.0,
  "entries": [
    {{
      "project_id": 3,
      "project_name": "ZIM",
      "hours": 0.5,
      "description": "Team-Austausch",
      "confidence": 0.95
    }}
  ],
  "new_project_suggestions": [
    {{ "detected_name": "Müller AG", "entry_index": 2 }}
  ]
}}

Sprachtext:
"{text}"
"""


@router.post("/parse-voice")
async def parse_voice(req: ParseRequest, db: Session = Depends(get_db)):
    if not MISTRAL_API_KEY:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    projects = db.query(Project).filter(Project.active == True).all()
    project_list = [
        {
            "id": p.id,
            "name": p.name,
            "shortcode": p.shortcode,
            "aliases": json.loads(p.aliases or "[]"),
        }
        for p in projects
    ]

    today = (req.entry_date or date.today()).isoformat()
    prompt = build_prompt(req.text, project_list, today)

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
