import os
import tempfile
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException

from auth import require_auth
from models import User

router = APIRouter(prefix="/api", tags=["transcribe"])
logger = logging.getLogger(__name__)

MODEL_DIR = "/app/whisper_models"
_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        logger.info("Loading Whisper base model (first use)…")
        _model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
            download_root=MODEL_DIR,
        )
        logger.info("Whisper model ready")
    return _model


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    user: User = Depends(require_auth),
):
    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Keine Audiodaten empfangen")

    suffix = os.path.splitext(audio.filename or ".webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(content)
        tmp_path = f.name

    try:
        model = get_model()
        segments, info = model.transcribe(
            tmp_path,
            language="de",
            task="transcribe",
            vad_filter=True,          # skip silence
            vad_parameters={"min_silence_duration_ms": 400},
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return {"text": text, "language": info.language}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transkription fehlgeschlagen: {e}")
    finally:
        os.unlink(tmp_path)
