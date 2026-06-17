from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json

from database import get_db
from models import Project, User
from auth import require_auth

router = APIRouter(prefix="/api/projects", tags=["projects"], dependencies=[Depends(require_auth)])


class ProjectCreate(BaseModel):
    name: str
    shortcode: str
    color: str = "#0070F2"
    client_name: str = ""
    aliases: list[str] = []
    active: bool = True
    pinned: bool = False
    sort_order: int = 0


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    shortcode: Optional[str] = None
    color: Optional[str] = None
    client_name: Optional[str] = None
    aliases: Optional[list[str]] = None
    active: Optional[bool] = None
    pinned: Optional[bool] = None
    sort_order: Optional[int] = None


def project_to_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "shortcode": p.shortcode,
        "color": p.color,
        "client_name": p.client_name,
        "aliases": json.loads(p.aliases or "[]"),
        "active": p.active,
        "pinned": p.pinned,
        "sort_order": p.sort_order,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.pinned.desc(), Project.sort_order, Project.name).all()
    return [project_to_dict(p) for p in projects]


@router.post("/")
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    p = Project(
        name=data.name,
        shortcode=data.shortcode,
        color=data.color,
        client_name=data.client_name,
        aliases=json.dumps(data.aliases),
        active=data.active,
        pinned=data.pinned,
        sort_order=data.sort_order,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return project_to_dict(p)


@router.patch("/{project_id}")
def update_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    if data.name is not None:
        p.name = data.name
    if data.shortcode is not None:
        p.shortcode = data.shortcode
    if data.color is not None:
        p.color = data.color
    if data.client_name is not None:
        p.client_name = data.client_name
    if data.aliases is not None:
        p.aliases = json.dumps(data.aliases)
    if data.active is not None:
        p.active = data.active
    if data.pinned is not None:
        p.pinned = data.pinned
    if data.sort_order is not None:
        p.sort_order = data.sort_order
    db.commit()
    db.refresh(p)
    return project_to_dict(p)


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/reorder")
def reorder_projects(order: list[dict], db: Session = Depends(get_db)):
    for item in order:
        p = db.query(Project).filter(Project.id == item["id"]).first()
        if p:
            p.sort_order = item["sort_order"]
    db.commit()
    return {"ok": True}
