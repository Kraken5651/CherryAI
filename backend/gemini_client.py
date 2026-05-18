"""
Shared Gemini client with automatic key rotation AND model fallbacks.
Uses GOOGLE_API_KEY + GOOGLE_API_KEYS for key rotation,
and GEMINI_MODEL + GEMINI_MODEL_FALLBACKS for model fallbacks.
"""
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

# ── API Key Pool ──────────────────────────────────────────────
def _build_clients() -> list[genai.Client]:
    clients = []
    key1 = os.getenv("GOOGLE_API_KEY", "")
    key2 = os.getenv("GOOGLE_API_KEYS", "")
    
    for key in [key1, key2]:
        if key.strip():
            clients.append(genai.Client(api_key=key.strip()))
    
    if not clients:
        raise RuntimeError("No Gemini API keys found in .env")
    
    return clients

clients = _build_clients()
_current_index = 0

# ── Model Fallback Chain ─────────────────────────────────────
PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
_fallback_str = os.getenv("GEMINI_MODEL_FALLBACKS", "")
FALLBACK_MODELS = [m.strip() for m in _fallback_str.split(",") if m.strip()] if _fallback_str else [PRIMARY_MODEL]

# Ensure primary is first in fallback list
if PRIMARY_MODEL not in FALLBACK_MODELS:
    FALLBACK_MODELS.insert(0, PRIMARY_MODEL)

print(f"[Cherry] API Keys loaded: {len(clients)}")
print(f"[Cherry] Model chain: {FALLBACK_MODELS}")

def get_client() -> genai.Client:
    return clients[_current_index]

def rotate_client() -> genai.Client:
    global _current_index
    _current_index = (_current_index + 1) % len(clients)
    return clients[_current_index]

def generate_with_fallback(model: str | None = None, contents=None, **kwargs):
    """
    Call generate_content with automatic key rotation + model fallbacks.
    - If a specific model is passed, tries that model across all keys first.
    - If model is None, walks the full GEMINI_MODEL_FALLBACKS chain.
    """
    models_to_try = [model] if model else FALLBACK_MODELS
    last_error = None
    
    for m in models_to_try:
        for _ in range(len(clients)):
            try:
                client = get_client()
                response = client.models.generate_content(model=m, contents=contents, **kwargs)
                print(f"[Cherry] Successfully generated content using model: {m}")
                return response
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                    print(f"[Cherry] Key {_current_index + 1} rate-limited/quota exceeded on {m}, rotating...")
                    rotate_client()
                    last_error = e
                    continue
                else:
                    print(f"[Cherry] Model {m} failed with error ({err_str}). Trying next model...")
                    last_error = e
                    break  # Skip to next model
    
    if last_error:
        raise last_error
    raise RuntimeError("All models and keys exhausted without a specific error.")
