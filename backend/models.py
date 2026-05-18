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

