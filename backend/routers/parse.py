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


SAP_PRODUCTS = """SAP-Produktliste (Ariba, SAP Ariba Invoicing, S/4HANA, BTP, Fiori, SuccessFactors, ABAP, Customizing, Transportauftrag, OData, SAP GUI, Basis, FI/CO, MM, SD, PP, QM, WM, EWM, HCM, MDG, GRC, PI/PO, Integration Suite, Analytics Cloud / SAC, Datasphere, IBP, Concur, ECC / R/3, ATP (Available to Promise), Cloud ALM / CALM, DRC (Document & Reporting Compliance), ECM (Engineering Change Management), BaDI (Business Add-In), Strecke (Drop Shipment MM/SD), Bedarfsklassen (PP Planung))"""

STYLE_EXAMPLES = """STILBEISPIELE — so sehen korrekte Beschreibungen aus (lerne Ton und Länge):
- "SAP Ariba Invoicing Kickoff inkl. Vor- und Nachbereitung"
- "Abstimmung und Bearbeitung Sprint 11 3-1981, 3-1988 inkl. Nachbereitung"
- "SAP Ariba Invoicing, Finalisierung Replikation inkl. Funktionstest"
- "Customizing SAP Ariba Invoicing"
- "Integrativer Test inkl. Vorbereitung ATP, Abstimmung mit Projektteam und Nachbereitung"
- "Datenmigration: MM-Objekte, Zugänge, Planung"
- "Abstimmung SAP SD/MM-Integration, Strecke ATP Bestellbestätigung"
- "Einrichtung SAP Ariba Invoicing, Terminplanung nach Rückmeldung"
- "Vorbereitung Workshop J45 inkl. Projektteamsetup, Protokoll und Nachbereitung"
- "Bearbeitung offene Aufgaben Sprint 13, MM-Kontenfindung"
"""


def build_prompt(text: str, projects: list[dict], today: str, job_context: str) -> str:
    project_list = json.dumps(projects, ensure_ascii=False, indent=2)
    return f"""Du bist ein intelligenter Zeiterfassungs-Assistent für einen hochspezialisierten SAP-Berater.

Deine Aufgabe: Extrahiere strukturierte Arbeitszeitbuchungen aus dem folgenden Freitext (Deutsch).

Benutzer-Rolle: {job_context}
Datum heute: {today}

{SAP_PRODUCTS}

{STYLE_EXAMPLES}

Bekannte Projekte (id, name, shortcode, aliases):
{project_list}

STRIKTE REGELN FÜR SPEECH-TO-TEXT & KONTEXT-OPTIMIERUNG (Höchste Priorität):
1. TYPO- & HÖRFEHLER-KORREKTUR: Der Input stammt aus einer Sprache-zu-Text-Eingabe. Korrigiere typische "Verhörer" (z.B. "Abend" oder "Aber" → "ABAP", "Theorie" → "Fiori", "BDP" → "BTP", "Kastomeising" → "Customizing"). Nutze die SAP-Produktliste als Referenz.
2. INTERNES SAP-FACHWISSEN NUTZEN: Wenn du auf einen unklaren Begriff stößt, der nach einem Tippfehler oder einem unbekannten SAP-Objekt/Modul/Framework klingt, nutze dein tiefes, internes SAP-Fachwissen, um den technologisch korrekten Begriff zu deduzieren und einzusetzen (Kontext-Abgleich).
3. STIL — KURZ UND FACHSPRACHLICH: Schreibe knapp wie in einer SAP-Projektzeiterfassung. Orientiere dich an den Stilbeispielen oben. Kein Fülltext, keine langen Sätze. Füge "inkl. Vor- und Nachbereitung" hinzu wenn Meetings oder Workshops erwähnt werden. Max. ~100 Zeichen pro Beschreibung.
4. STRIKTE ANONYMISIERUNG: Ersetze Personennamen (z.B. "Marco", "Tanja") durch "Projektteam" oder "Ansprechpartner des Kunden". Firmennamen NICHT in der Beschreibung nennen. Ticketnummern (3-XXXX), Sprint-Nummern, Workshop-Codes (J45, 5W3, 18J) und Scope-Kürzel bleiben erhalten.
5. SAP-FOKUS: Achte penibel darauf, dass der SAP-spezifische Kontext (Modulnamen, technische Begriffe) im optimierten Text erhalten bleibt und korrekt angewendet wird.
6. CODES & KÜRZEL BEWAHREN: Ticketnummern (3-XXXX), Sprint XX, Workshop-Codes (J45, 5W3, 18J), Projektphasen (PP04) und ähnliche Bezeichner exakt übernehmen — nicht kürzen, nicht weglassen.

PROJEKT-MATCHING-REGELN:
7. Extrahiere ALLE erwähnten Projektzeitbuchungen.
8. Projekt-Matching — Priorität in dieser Reihenfolge:
   a) Exakter Shortcode-Treffer (case-insensitiv) → confidence: 1.0, KEIN Fuzzy-Matching, KEINE Verwechslung ähnlicher Kürzel (ZIM ≠ CIM, RK ≠ FK, etc.)
   b) Exakter Name-Treffer oder Alias-Treffer → confidence: 0.95
   c) Fuzzy-Matching nur wenn kein exakter Treffer → confidence je nach Ähnlichkeit
9. Konfidenz >= 0.8 → project_id setzen. Darunter → project_id: null + new_project_suggestions Eintrag.
10. Stundenangaben: "halbe Stunde" = 0.5, "anderthalb" = 1.5, "Viertel" = 0.25, "dreiviertel" = 0.75.
11. Kein Datum im Text → heutiges Datum verwenden: {today}.
12. NIEMALS Projektnamen erfinden die nicht in der Liste stehen.

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
