import os
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import edge_tts
from google.genai import types
from gemini_client import generate_with_fallback

import re

load_dotenv()

router = APIRouter()

def clean_for_speech(text: str) -> str:
    """Strip markdown and special characters so TTS reads naturally."""
    # Remove code blocks
    text = re.sub(r'```[\s\S]*?```', ' code block omitted ', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove markdown headers
    text = re.sub(r'#{1,6}\s*', '', text)
    # Remove bold/italic markers
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', text)
    # Remove bullet points and list markers
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)
    # Remove links [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove images ![alt](url)
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', '', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove remaining special chars that sound weird spoken
    text = re.sub(r'[~|>]', '', text)
    # Collapse multiple spaces/newlines
    text = re.sub(r'\n+', '. ', text)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()

class TTSRequest(BaseModel):
    text: str

@router.post("/speak")
async def generate_speech(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
        
    voice = os.getenv("VOICE", "en-US-JennyNeural")
    
    text = clean_for_speech(request.text)
    
    tmp_path = os.path.join(tempfile.gettempdir(), f"cherry_tts_{os.urandom(4).hex()}.mp3")
    
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(tmp_path)
        return FileResponse(tmp_path, media_type="audio/mpeg", filename="speech.mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        content = await file.read()
        
        if len(content) < 100:
            return {"text": ""}
        
        # Use model fallback chain from .env for transcription
        response = generate_with_fallback(
            contents=[
                types.Content(role="user", parts=[
                    types.Part.from_text(text="Transcribe this audio exactly as spoken. Return ONLY the transcription, nothing else. If silent, return empty."),
                    types.Part.from_bytes(data=content, mime_type=file.content_type or "audio/webm"),
                ])
            ]
        )
        
        text = response.text.strip() if response.text else ""
        return {"text": text}
    except Exception as e:
        print(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
