import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import User, Config
from auth import require_auth
from push import send_push_to_user, get_vapid_public_key

router = APIRouter(prefix="/api/push", tags=["push"])


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict
    expirationTime: Optional[float] = None


class NotifySettings(BaseModel):
    notify_time: Optional[str] = None
    notify_enabled: Optional[bool] = None


@router.get("/vapid-key")
def vapid_key(db: Session = Depends(get_db)):
    key = get_vapid_public_key(db)
    return {"public_key": key}


@router.post("/subscribe")
def subscribe(sub: PushSubscription, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    user.push_subscription = sub.model_dump_json()
    user.notify_enabled = True
    db.commit()
    return {"ok": True}


@router.delete("/subscribe")
def unsubscribe(user: User = Depends(require_auth), db: Session = Depends(get_db)):
    user.push_subscription = None
    user.notify_enabled = False
    db.commit()
    return {"ok": True}


@router.patch("/settings")
def update_settings(data: NotifySettings, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if data.notify_time is not None:
        user.notify_time = data.notify_time
    if data.notify_enabled is not None:
        user.notify_enabled = data.notify_enabled
    db.commit()
    db.refresh(user)
    return {"notify_time": user.notify_time, "notify_enabled": user.notify_enabled}


@router.post("/test")
async def test_push(user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if not user.push_subscription:
        raise HTTPException(status_code=400, detail="Keine Push-Subscription vorhanden")
    await send_push_to_user(user, db, title="⏱ Test", body="Push-Benachrichtigung funktioniert!")
    return {"ok": True}
