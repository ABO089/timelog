import json
import base64
import logging
from sqlalchemy.orm import Session
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

logger = logging.getLogger(__name__)

VAPID_EMAIL = "mailto:aljoschaboss@googlemail.com"


def _generate_vapid_keys() -> tuple[str, str]:
    """Generate VAPID key pair. Returns (private_pem, public_b64url)."""
    key = ec.generate_private_key(ec.SECP256R1())
    private_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption()
    ).decode()
    public_bytes = key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint
    )
    public_b64url = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()
    return private_pem, public_b64url


def ensure_vapid_keys(db: Session) -> tuple[str, str]:
    """Get existing VAPID keys from DB or generate new ones."""
    from models import Config
    priv = db.query(Config).filter_by(key="vapid_private_key").first()
    pub = db.query(Config).filter_by(key="vapid_public_key").first()
    if priv and pub:
        return priv.value, pub.value
    private_pem, public_b64url = _generate_vapid_keys()
    db.merge(Config(key="vapid_private_key", value=private_pem))
    db.merge(Config(key="vapid_public_key", value=public_b64url))
    db.commit()
    logger.info("VAPID keys generated and stored in DB")
    return private_pem, public_b64url


def get_vapid_public_key(db: Session) -> str:
    from models import Config
    pub = db.query(Config).filter_by(key="vapid_public_key").first()
    return pub.value if pub else ""


async def send_push_to_user(user, db: Session, title: str = "⏱ TimeLog", body: str = "Arbeitszeit eintragen!"):
    if not user.push_subscription:
        return
    from pywebpush import webpush, WebPushException
    private_pem, _ = ensure_vapid_keys(db)
    try:
        sub = json.loads(user.push_subscription)
        webpush(
            subscription_info=sub,
            data=json.dumps({"title": title, "body": body}),
            vapid_private_key=private_pem,
            vapid_claims={"sub": VAPID_EMAIL},
        )
    except WebPushException as e:
        logger.error(f"Push failed for {user.email}: {e}")
        # Subscription expired → remove it
        if e.response and e.response.status_code in (404, 410):
            user.push_subscription = None
            user.notify_enabled = False
            db.commit()
