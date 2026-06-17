from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
from models import User
from auth import hash_password, verify_password, create_token, require_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str


class ProfileUpdate(BaseModel):
    job_context: Optional[str] = None


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-Mail oder Passwort falsch")
    token = create_token(user.id, user.email)
    return {"access_token": token, "token_type": "bearer", "email": user.email, "job_context": user.job_context}


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(status_code=403, detail="Registrierung geschlossen — nur ein Benutzer erlaubt")
    user = User(email=data.email, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token(user.id, user.email)
    return {"access_token": token, "token_type": "bearer", "email": user.email, "job_context": user.job_context}


@router.get("/me")
def me(user: User = Depends(require_auth)):
    return {"id": user.id, "email": user.email, "job_context": user.job_context}


@router.patch("/profile")
def update_profile(data: ProfileUpdate, user: User = Depends(require_auth), db: Session = Depends(get_db)):
    if data.job_context is not None:
        user.job_context = data.job_context
    db.commit()
    db.refresh(user)
    return {"email": user.email, "job_context": user.job_context}


@router.post("/logout")
def logout():
    return {"ok": True}
