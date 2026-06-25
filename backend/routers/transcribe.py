import os
import asyncio
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
import httpx

from auth import require_auth
from models import User

router = APIRouter(prefix="/api", tags=["transcribe"])
logger = logging.getLogger(__name__)

GLADIA_API_KEY = os.getenv("GLADIA_API_KEY", "")
GLADIA_UPLOAD = "https://api.gladia.io/v2/upload"
GLADIA_TRANSCRIBE = "https://api.gladia.io/v2/pre-recorded"


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    user: User = Depends(require_auth),
):
    if not GLADIA_API_KEY:
        raise HTTPException(status_code=500, detail="GLADIA_API_KEY nicht konfiguriert")

    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Keine Audiodaten empfangen")

    headers = {"x-gladia-key": GLADIA_API_KEY}

    async with httpx.AsyncClient(timeout=60) as client:
        # 1. Upload audio
        upload = await client.post(
            GLADIA_UPLOAD,
            headers=headers,
            files={"audio": (audio.filename or "recording.webm", content, audio.content_type or "audio/webm")},
        )
        if not upload.is_success:
            raise HTTPException(status_code=502, detail=f"Gladia Upload fehlgeschlagen: {upload.status_code}")
        audio_url = upload.json()["audio_url"]

        # 2. Request transcription
        trans = await client.post(
            GLADIA_TRANSCRIBE,
            headers={**headers, "Content-Type": "application/json"},
            json={
                "audio_url": audio_url,
                "language_config": {
                    "languages": ["de"],
                    "code_switching": False,
                },
            },
        )
        if not trans.is_success:
            raise HTTPException(status_code=502, detail=f"Gladia Transkription fehlgeschlagen: {trans.status_code}")

        result_url = trans.json()["result_url"]

        # 3. Poll until done (max 30s)
        for _ in range(30):
            await asyncio.sleep(1)
            poll = await client.get(result_url, headers=headers)
            data = poll.json()
            status = data.get("status")
            if status == "done":
                text = data["result"]["transcription"]["full_transcript"]
                return {"text": text.strip()}
            if status == "error":
                raise HTTPException(status_code=502, detail="Gladia: Transkription fehlgeschlagen")

    raise HTTPException(status_code=504, detail="Gladia: Timeout bei der Transkription")
