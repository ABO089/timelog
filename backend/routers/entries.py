from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timedelta
import json

from database import get_db
from models import Entry, Project

router = APIRouter(prefix="/api/entries", tags=["entries"])


class EntryCreate(BaseModel):
    date: date
    project_id: int
    duration_hours: float
    description: str = ""


class EntryUpdate(BaseModel):
    project_id: Optional[int] = None
    duration_hours: Optional[float] = None
    description: Optional[str] = None


def entry_to_dict(e: Entry) -> dict:
    return {
        "id": e.id,
        "date": e.date.isoformat(),
        "project_id": e.project_id,
        "project_name": e.project.name if e.project else None,
        "project_shortcode": e.project.shortcode if e.project else None,
        "project_color": e.project.color if e.project else "#ccc",
        "duration_hours": e.duration_hours,
        "description": e.description,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/day/{day}")
def get_entries_for_day(day: date, db: Session = Depends(get_db)):
    entries = (
        db.query(Entry)
        .filter(Entry.date == day)
        .order_by(Entry.created_at)
        .all()
    )
    total = sum(e.duration_hours for e in entries)
    return {"date": day.isoformat(), "total_hours": total, "entries": [entry_to_dict(e) for e in entries]}


@router.get("/week/{week_start}")
def get_entries_for_week(week_start: date, db: Session = Depends(get_db)):
    week_end = week_start + timedelta(days=6)
    entries = (
        db.query(Entry)
        .filter(Entry.date >= week_start, Entry.date <= week_end)
        .order_by(Entry.date, Entry.created_at)
        .all()
    )
    return [entry_to_dict(e) for e in entries]


@router.post("/")
def create_entry(data: EntryCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    e = Entry(
        date=data.date,
        project_id=data.project_id,
        duration_hours=data.duration_hours,
        description=data.description,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return entry_to_dict(e)


@router.post("/bulk")
def create_entries_bulk(entries: list[EntryCreate], db: Session = Depends(get_db)):
    created = []
    for data in entries:
        project = db.query(Project).filter(Project.id == data.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail=f"Project {data.project_id} not found")
        e = Entry(
            date=data.date,
            project_id=data.project_id,
            duration_hours=data.duration_hours,
            description=data.description,
        )
        db.add(e)
        db.flush()
        db.refresh(e)
        created.append(entry_to_dict(e))
    db.commit()
    return created


@router.patch("/{entry_id}")
def update_entry(entry_id: int, data: EntryUpdate, db: Session = Depends(get_db)):
    e = db.query(Entry).filter(Entry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    if data.project_id is not None:
        e.project_id = data.project_id
    if data.duration_hours is not None:
        e.duration_hours = data.duration_hours
    if data.description is not None:
        e.description = data.description
    e.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(e)
    return entry_to_dict(e)


@router.delete("/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    e = db.query(Entry).filter(Entry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(e)
    db.commit()
    return {"ok": True}
