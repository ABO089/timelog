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


SAP_PRODUCTS = """Bekannte SAP-Produktnamen und korrekte Schreibweisen (immer so normalisieren):
- SAP Ariba (nicht: arriba, Arriba, ariba) – Beschaffungsplattform; Module: Ariba Invoicing, Ariba Sourcing, Ariba Contracts, Ariba Network
- SAP S/4HANA (nicht: S4, S4Hana, s4hana)
- SAP ECC / R/3
- SAP Fiori
- SAP BTP (Business Technology Platform)
- SAP SuccessFactors
- SAP Concur
- SAP MDG (Master Data Governance)
- SAP GRC
- SAP PI/PO / SAP Integration Suite
- SAP Analytics Cloud (SAC)
- SAP Datasphere
- SAP IBP (Integrated Business Planning)
- SAP MM, SD, FI, CO, PP, WM, EWM, HCM (Modulkürzel großschreiben)
"""

def build_prompt(text: str, projects: list[dict], today: str, job_context: str) -> str:
    project_list = json.dumps(projects, ensure_ascii=False, indent=2)
    sap_context = SAP_PRODUCTS if "sap" in job_context.lower() else ""
    return f"""Du bist ein intelligenter Zeiterfassungs-Assistent für eine Fachkraft im Bereich "{job_context}".

Deine Aufgabe: Extrahiere strukturierte Arbeitszeitbuchungen aus dem folgenden Freitext (Deutsch).

Benutzer-Rolle: {job_context}
Datum heute: {today}
{sap_context}
Bekannte Projekte (id, name, shortcode, aliases):
{project_list}

Regeln:
1. Extrahiere ALLE erwähnten Projektzeitbuchungen.
2. Projekt-Matching — Priorität in dieser Reihenfolge:
   a) Exakter Shortcode-Treffer (case-insensitiv) → confidence: 1.0, KEIN Fuzzy-Matching, KEINE Verwechslung ähnlicher Kürzel (ZIM ≠ CIM, RK ≠ FK, etc.)
   b) Exakter Name-Treffer oder Alias-Treffer → confidence: 0.95
   c) Fuzzy-Matching nur wenn kein exakter Treffer → confidence je nach Ähnlichkeit
3. Konfidenz >= 0.8 → project_id setzen. Darunter → project_id: null + new_project_suggestions Eintrag.
4. Stundenangaben: "halbe Stunde" = 0.5, "anderthalb" = 1.5, "Viertel" = 0.25, "dreiviertel" = 0.75.
5. Kein Datum im Text → heutiges Datum verwenden: {today}.
6. Beschreibung: professionell, prägnant, auf Deutsch, kundentauglich (max. 60 Zeichen). Keine Umgangssprache.
   Kontext beachten: Tätigkeitsbeschreibungen sollen für einen {job_context} typisch und fachlich korrekt sein.
7. SAP-Produktnamen IMMER in korrekter Schreibweise verwenden (siehe Liste oben). Tippfehler im Input korrigieren.
8. NIEMALS Projektnamen erfinden die nicht in der Liste stehen. Nur bekannte Projekte verwenden oder new_project_suggestions.

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
