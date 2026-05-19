from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

router = APIRouter()

# ── Pydantic Schemas ───────────────────────────────────────────

class NoteCreate(BaseModel):
    title: str
    content: str

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class ReminderCreate(BaseModel):
    title: str
    reminder_time: datetime

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    reminder_time: Optional[datetime] = None
    is_completed: Optional[bool] = None

class PlannerTaskCreate(BaseModel):
    title: str
    date: str  # Format: YYYY-MM-DD
    time_slot: Optional[str] = None

class PlannerTaskUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time_slot: Optional[str] = None
    is_completed: Optional[bool] = None


# ── Notes Endpoints ────────────────────────────────────────────

@router.get("/notes")
def get_notes(db: Session = Depends(get_db)):
    notes = db.query(models.Note).order_by(models.Note.updated_at.desc()).all()
    return notes

@router.post("/notes")
def create_note(note: NoteCreate, db: Session = Depends(get_db)):
    db_note = models.Note(title=note.title, content=note.content)
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

@router.put("/notes/{note_id}")
def update_note(note_id: int, note_data: NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if note_data.title is not None:
        db_note.title = note_data.title
    if note_data.content is not None:
        db_note.content = note_data.content
        
    db_note.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_note)
    return db_note

@router.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(db_note)
    db.commit()
    return {"message": "Note deleted successfully"}


# ── Reminders Endpoints ────────────────────────────────────────

@router.get("/reminders")
def get_reminders(db: Session = Depends(get_db)):
    reminders = db.query(models.Reminder).order_by(models.Reminder.reminder_time.asc()).all()
    return reminders

@router.post("/reminders")
def create_reminder(reminder: ReminderCreate, db: Session = Depends(get_db)):
    db_reminder = models.Reminder(
        title=reminder.title,
        reminder_time=reminder.reminder_time,
        is_completed=False
    )
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.put("/reminders/{reminder_id}")
def update_reminder(reminder_id: int, reminder_data: ReminderUpdate, db: Session = Depends(get_db)):
    db_reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    if reminder_data.title is not None:
        db_reminder.title = reminder_data.title
    if reminder_data.reminder_time is not None:
        db_reminder.reminder_time = reminder_data.reminder_time
    if reminder_data.is_completed is not None:
        db_reminder.is_completed = reminder_data.is_completed
        
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    db_reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    db.delete(db_reminder)
    db.commit()
    return {"message": "Reminder deleted successfully"}


# ── Daily Planner Endpoints ────────────────────────────────────

@router.get("/planner")
def get_planner_tasks(date: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.PlannerTask)
    if date:
        query = query.filter(models.PlannerTask.date == date)
    tasks = query.order_by(models.PlannerTask.time_slot.asc(), models.PlannerTask.created_at.asc()).all()
    return tasks

@router.post("/planner")
def create_planner_task(task: PlannerTaskCreate, db: Session = Depends(get_db)):
    db_task = models.PlannerTask(
        title=task.title,
        date=task.date,
        time_slot=task.time_slot,
        is_completed=False
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.put("/planner/{task_id}")
def update_planner_task(task_id: int, task_data: PlannerTaskUpdate, db: Session = Depends(get_db)):
    db_task = db.query(models.PlannerTask).filter(models.PlannerTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_data.title is not None:
        db_task.title = task_data.title
    if task_data.date is not None:
        db_task.date = task_data.date
    if task_data.time_slot is not None:
        db_task.time_slot = task_data.time_slot
    if task_data.is_completed is not None:
        db_task.is_completed = task_data.is_completed
        
    db.commit()
    db.refresh(db_task)
    return db_task

@router.delete("/planner/{task_id}")
def delete_planner_task(task_id: int, db: Session = Depends(get_db)):
    db_task = db.query(models.PlannerTask).filter(models.PlannerTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(db_task)
    db.commit()
    return {"message": "Planner task deleted successfully"}
