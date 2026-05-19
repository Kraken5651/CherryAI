from sqlalchemy import Column, Integer, String, Boolean, DateTime
from database import Base
import datetime

class ImageRecord(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    prompt = Column(String, index=True)
    filename = Column(String, unique=True, index=True)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class EditedFileRecord(Base):
    __tablename__ = "edited_files"

    id = Column(Integer, primary_key=True, index=True)
    original_name = Column(String, index=True)
    filename = Column(String, unique=True, index=True)
    file_type = Column(String, index=True)  # "image" or "pdf"
    filepath = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    reminder_time = Column(DateTime)
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PlannerTask(Base):
    __tablename__ = "planner_tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    date = Column(String, index=True)  # Format: YYYY-MM-DD
    time_slot = Column(String, nullable=True)  # e.g., "09:00"
    is_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


