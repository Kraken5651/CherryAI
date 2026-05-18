from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
import shutil
from pydantic import BaseModel
from google.genai import types
from gemini_client import generate_with_fallback
from sqlalchemy.orm import Session
from database import get_db
import models
import uuid
import requests
from urllib.parse import quote
from pathlib import Path

router = APIRouter()

class MessageHistory(BaseModel):
    role: str
    parts: str

class ChatRequest(BaseModel):
    message: str
    history: list[MessageHistory] = []

@router.post("")
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        message_str = request.message.strip()
        message_lower = message_str.lower()
        
        # Check if the prompt triggers image generation
        is_generation = False
        prompt_to_generate = ""
        
        # Command prefixes
        prefixes = [
            "/generate ", "/draw ", "/image ", 
            "generate an image of ", "generate a picture of ", 
            "generate a drawing of ", "generate a painting of ",
            "generate a sketch of ", "generate image of ", "generate picture of ",
            "draw an image of ", "draw a picture of ", "draw a ", "draw an ", "draw ",
            "create an image of ", "create a picture of ", "create a drawing of ", "create a painting of "
        ]
        
        # Also handle exact commands like "/generate", "/draw", "/image" without prompts
        if message_lower in ["/generate", "/draw", "/image"]:
            return {
                "response": "Sure! Please provide a prompt with the command. For example: `/generate a futuristic cyberpunk city` or `draw a majestic dragon flying over mountains`."
            }
            
        for prefix in prefixes:
            if message_lower.startswith(prefix):
                is_generation = True
                prompt_to_generate = message_str[len(prefix):].strip()
                break
                
        if is_generation:
            if not prompt_to_generate:
                return {
                    "response": "Please specify what you would like me to generate. For example: `/generate a cute red cherry in high definition`."
                }
                
            # Define gallery upload directory
            GALLERY_DIR = Path("uploads/gallery")
            GALLERY_DIR.mkdir(parents=True, exist_ok=True)
            
            encoded_prompt = quote(prompt_to_generate)
            seed = uuid.uuid4().hex[:8]
            image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}%20{seed}?nologo=true&enhance=true"
            
            # Download the image
            res = requests.get(image_url, timeout=30)
            if res.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch image from generator")
                
            filename = f"{uuid.uuid4().hex}.jpg"
            filepath = GALLERY_DIR / filename
            
            with open(filepath, "wb") as f:
                f.write(res.content)
                
            # Save to DB
            db_image = models.ImageRecord(prompt=prompt_to_generate, filename=filename)
            db.add(db_image)
            db.commit()
            db.refresh(db_image)
            
            image_relative_url = f"/api/gallery/images/{filename}"
            
            return {
                "response": f"I have successfully generated your image for: **\"{prompt_to_generate}\"**! It has also been saved to your **Gallery**.",
                "imageUrl": image_relative_url
            }
            
        # Standard chat generation
        # Build contents list for the API
        contents = []
        for msg in request.history:
            contents.append(types.Content(
                role=msg.role,
                parts=[types.Part.from_text(text=msg.parts)]
            ))
        # Add the current user message
        contents.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=request.message)]
        ))
        
        response = generate_with_fallback(contents=contents)
        
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


TEMP_DIR = Path("uploads/chat_temp")
EDITED_DIR = Path("uploads/chat_edited")
TEMP_DIR.mkdir(parents=True, exist_ok=True)
EDITED_DIR.mkdir(parents=True, exist_ok=True)

# Helper to extract PDF text
def extract_pdf_text(filepath: Path) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(filepath))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""

@router.post("/upload")
async def upload_chat_file(file: UploadFile = File(...)):
    filename = file.filename or "uploaded_file"
    ext = Path(filename).suffix.lower()
    
    # Save the uploaded file temporarily
    temp_filename = f"{uuid.uuid4().hex}{ext}"
    temp_path = TEMP_DIR / temp_filename
    
    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        file_type = "pdf" if ext == ".pdf" else "image"
        text_content = ""
        
        if file_type == "pdf":
            text_content = extract_pdf_text(temp_path)
            
        return {
            "original_name": filename,
            "temp_filename": temp_filename,
            "file_type": file_type,
            "text": text_content,
            "url": f"/api/chat/temp/{temp_filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-edited")
async def save_edited_file(
    file: UploadFile = File(...),
    original_name: str = Form(...),
    file_type: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        ext = Path(original_name).suffix.lower()
        saved_filename = f"{uuid.uuid4().hex}{ext}"
        saved_path = EDITED_DIR / saved_filename
        
        # Save the edited file
        with open(saved_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Create a database record
        db_record = models.EditedFileRecord(
            original_name=original_name,
            filename=saved_filename,
            file_type=file_type,
            filepath=str(saved_path)
        )
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        
        return {
            "id": db_record.id,
            "original_name": original_name,
            "filename": saved_filename,
            "file_type": file_type,
            "url": f"/api/chat/download/{saved_filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
async def download_edited_file(filename: str):
    filepath = EDITED_DIR / filename
    if not filepath.exists():
        # Fall back to checking temp dir just in case
        filepath = TEMP_DIR / filename
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="File not found")
            
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/octet-stream"
    )

# Serve temp files
@router.get("/temp/{filename}")
async def get_temp_file(filename: str):
    filepath = TEMP_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

@router.get("/edited-files")
async def list_edited_files(db: Session = Depends(get_db)):
    try:
        records = db.query(models.EditedFileRecord).order_by(models.EditedFileRecord.created_at.desc()).all()
        return [
            {
                "id": rec.id,
                "original_name": rec.original_name,
                "filename": rec.filename,
                "file_type": rec.file_type,
                "url": f"/api/chat/download/{rec.filename}",
                "created_at": rec.created_at.isoformat()
            }
            for rec in records
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
