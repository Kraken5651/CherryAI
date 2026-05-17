import os
import uuid
import requests
from urllib.parse import quote
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db

router = APIRouter()

# Directory for storing generated images
GALLERY_DIR = Path("uploads/gallery")
GALLERY_DIR.mkdir(parents=True, exist_ok=True)

class GenerateRequest(BaseModel):
    prompt: str

@router.post("/generate")
async def generate_image(request: GenerateRequest, db: Session = Depends(get_db)):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    prompt = request.prompt.strip()
    encoded_prompt = quote(prompt)
    
    # We use pollinations.ai for free, fast, high-quality image generation.
    # It generates an image deterministically based on the prompt. To make it random, we append a random seed.
    seed = uuid.uuid4().hex[:8]
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}%20{seed}?nologo=true&enhance=true"
    
    try:
        # Download the image
        res = requests.get(image_url, timeout=30)
        if res.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch image from generator")
            
        filename = f"{uuid.uuid4().hex}.jpg"
        filepath = GALLERY_DIR / filename
        
        with open(filepath, "wb") as f:
            f.write(res.content)
            
        # Save to DB
        db_image = models.ImageRecord(prompt=prompt, filename=filename)
        db.add(db_image)
        db.commit()
        db.refresh(db_image)
        
        return {
            "id": db_image.id,
            "prompt": db_image.prompt,
            "filename": db_image.filename,
            "is_favorite": db_image.is_favorite,
            "url": f"/api/gallery/images/{db_image.filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def list_images(db: Session = Depends(get_db)):
    images = db.query(models.ImageRecord).order_by(models.ImageRecord.created_at.desc()).all()
    return [
        {
            "id": img.id,
            "prompt": img.prompt,
            "filename": img.filename,
            "is_favorite": img.is_favorite,
            "url": f"/api/gallery/images/{img.filename}"
        }
        for img in images
    ]

@router.put("/{image_id}/favorite")
async def toggle_favorite(image_id: int, db: Session = Depends(get_db)):
    img = db.query(models.ImageRecord).filter(models.ImageRecord.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
        
    img.is_favorite = not img.is_favorite
    db.commit()
    return {"is_favorite": img.is_favorite}

@router.delete("/{image_id}")
async def delete_image(image_id: int, db: Session = Depends(get_db)):
    img = db.query(models.ImageRecord).filter(models.ImageRecord.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
        
    filepath = GALLERY_DIR / img.filename
    filepath.unlink(missing_ok=True)
    
    db.delete(img)
    db.commit()
    return {"status": "deleted"}

@router.get("/images/{filename}")
async def get_image(filename: str):
    filepath = GALLERY_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)
