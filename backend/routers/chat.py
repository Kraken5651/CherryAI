from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.genai import types
from gemini_client import generate_with_fallback

router = APIRouter()

class MessageHistory(BaseModel):
    role: str
    parts: str

class ChatRequest(BaseModel):
    message: str
    history: list[MessageHistory] = []

@router.post("")
async def chat_endpoint(request: ChatRequest):
    try:
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
