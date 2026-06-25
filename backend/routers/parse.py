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


SAP_PRODUCTS = """SAP-Produktliste (Ariba, S/4HANA, BTP, Fiori, SuccessFactors, ABAP, Customizing, Transportauftrag, OData, SAP GUI, Basis, FI/CO, MM, SD, PP, WM, EWM, HCM, MDG, GRC, PI/PO, Integration Suite, Analytics Cloud / SAC, Datasphere, IBP, Concur, ECC / R/3)"""


def build_prompt(text: str, projects: list[dict], today: str, job_context: str) -> str:
    project_list = json.dumps(projects, ensure_ascii=False, indent=2)
    return f"""Du bist ein intelligenter Zeiterfassungs-Assistent für einen hochspezialisierten SAP-Berater.

Deine Aufgabe: Extrahiere strukturierte Arbeitszeitbuchungen aus dem folgenden Freitext (Deutsch).

Benutzer-Rolle: {job_context}
Datum heute: {today}

{SAP_PRODUCTS}

Bekannte Projekte (id, name, shortcode, aliases):
{project_list}

STRIKTE REGELN FÜR SPEECH-TO-TEXT & KONTEXT-OPTIMIERUNG (Höchste Priorität):
1. TYPO- & HÖRFEHLER-KORREKTUR: Der Input stammt aus einer Sprache-zu-Text-Eingabe. Korrigiere typische "Verhörer" (z.B. "Abend" oder "Aber" → "ABAP", "Theorie" → "Fiori", "BDP" → "BTP", "Kastomeising" → "Customizing"). Nutze die SAP-Produktliste als Referenz.
2. INTERNES SAP-FACHWISSEN NUTZEN: Wenn du auf einen unklaren Begriff stößt, der nach einem Tippfehler oder einem unbekannten SAP-Objekt/Modul/Framework klingt, nutze dein tiefes, internes SAP-Fachwissen, um den technologisch korrekten Begriff zu deduzieren und einzusetzen (Kontext-Abgleich).
3. PROFESSIONALISIERUNG FÜR RECHNUNGEN: Formuliere die Beschreibungen so um, dass sie direkt auf einer Kundenrechnung ausgewiesen werden können. Nutze einen beratungstypischen, professionellen und prägnanten Stil. Beginne idealerweise mit aktiven Substantiven oder Verben (z.B. "Analyse von...", "Konzeptionierung...", "Implementierung...", "Fehlerbehebung im Bereich...").
4. STRIKTE ANONYMISIERUNG: Erwähne NIEMALS konkrete Personennamen (z.B. "Herr Müller", "die Sabine") oder externe Firmennamen im finalen Beschreibungstext. Ersetze diese konsequent durch "Ansprechpartner des Kunden" oder "Projektteam". Der Text muss für den Endkunden freigegeben werden können.
5. SAP-FOKUS: Achte penibel darauf, dass der SAP-spezifische Kontext (Modulnamen, technische Begriffe) im optimierten Text erhalten bleibt und korrekt angewendet wird.

PROJEKT-MATCHING-REGELN:
6. Extrahiere ALLE erwähnten Projektzeitbuchungen.
7. Projekt-Matching — Priorität in dieser Reihenfolge:
   a) Exakter Shortcode-Treffer (case-insensitiv) → confidence: 1.0, KEIN Fuzzy-Matching, KEINE Verwechslung ähnlicher Kürzel (ZIM ≠ CIM, RK ≠ FK, etc.)
   b) Exakter Name-Treffer oder Alias-Treffer → confidence: 0.95
   c) Fuzzy-Matching nur wenn kein exakter Treffer → confidence je nach Ähnlichkeit
8. Konfidenz >= 0.8 → project_id setzen. Darunter → project_id: null + new_project_suggestions Eintrag.
9. Stundenangaben: "halbe Stunde" = 0.5, "anderthalb" = 1.5, "Viertel" = 0.25, "dreiviertel" = 0.75.
10. Kein Datum im Text → heutiges Datum verwenden: {today}.
11. NIEMALS Projektnamen erfinden die nicht in der Liste stehen.

RÜCKGABEFORMAT (Striktes JSON):
Antworte AUSSCHLIESSLICH im folgenden JSON-Format ohne zusätzlichen Text oder Markdown:
{{
  "date": "YYYY-MM-DD",
  "total_hours": 8.0,
  "entries": [
    {{
      "project_id": 1,
      "project_name": "CIM Thementeam",
      "hours": 1.5,
      "description": "Analyse von Customizing-Einstellungen im SAP FI-Modul mit Projektteam",
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
