from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx
import os

from database import get_db
from models import User
from auth import require_auth

router = APIRouter(prefix="/api", tags=["improve"])

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = "mistral-large-latest"


class ImproveRequest(BaseModel):
    description: str
    project_name: str
    hours: float


@router.post("/improve-description")
async def improve_description(req: ImproveRequest, user: User = Depends(require_auth)):
    if not MISTRAL_API_KEY:
        raise HTTPException(status_code=500, detail="MISTRAL_API_KEY not configured")

    job_context = user.job_context or "SAP Berater"

    prompt = f"""Du bist ein Experte für professionelle Leistungsnachweise im Bereich "{job_context}".

Aufgabe: Formuliere die folgende Tätigkeitsbeschreibung so um, dass sie für einen Kunden-Stundenzettel / eine Faktura geeignet ist.

Eingabe:
- Projekt: {req.project_name}
- Stunden: {req.hours}
- Rohbeschreibung: "{req.description}"

Anforderungen:
- Professionell, präzise, kundentauglich — geeignet für Leistungsnachweis / Rechnung
- Fachterminologie aus dem Bereich "{job_context}" verwenden
- SAP-Produktnamen korrekt schreiben (SAP Ariba, SAP S/4HANA, etc.)
- Aktive Formulierung, z.B. "Durchführung Workshop", "Konzeption Berechtigungskonzept", "Analyse Fehlerprotokoll"
- Max. 80 Zeichen, kein Punkt am Ende
- NUR die verbesserte Beschreibung zurückgeben, kein Kommentar

Verbesserte Beschreibung:"""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.mistral.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {MISTRAL_API_KEY}"},
                json={
                    "model": MISTRAL_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 100,
                },
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Mistral error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=str(e))

    text = response.json()["choices"][0]["message"]["content"].strip().strip('"').strip("'")
    return {"improved": text}
