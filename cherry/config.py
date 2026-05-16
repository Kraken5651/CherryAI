import os
import re
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env", override=True)


def _bool(val: str | None, default: bool) -> bool:
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


def _paths(raw: str | None) -> list[Path]:
    if not raw:
        return [Path.home() / "Documents", _ROOT]
    parts = [p.strip() for p in raw.split(";") if p.strip()]
    return [Path(os.path.expandvars(p)).resolve() for p in parts]


def _split_keys(raw: str) -> list[str]:
    """Split comma/semicolon/newline-separated API keys."""
    out: list[str] = []
    for part in re.split(r"[,;\n]+", raw):
        k = part.strip().strip('"').strip("'")
        if k and k not in out:
            out.append(k)
    return out


def _collect_api_keys() -> list[str]:
    keys: list[str] = []
    primary_raw = (
        os.getenv("GOOGLE_API_KEY", "").strip()
        or os.getenv("GEMINI_API_KEY", "").strip()
    )
    for k in _split_keys(primary_raw):
        keys.append(k)
    for k in _split_keys(os.getenv("GOOGLE_API_KEYS", "")):
        if k not in keys:
            keys.append(k)
    return keys


GOOGLE_API_KEYS = _collect_api_keys()
GOOGLE_API_KEY = GOOGLE_API_KEYS[0] if GOOGLE_API_KEYS else ""
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_MODEL_FALLBACKS = [
    m.strip()
    for m in os.getenv(
        "GEMINI_MODEL_FALLBACKS",
        "gemini-2.5-flash,gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.0-flash-lite",
    ).split(",")
    if m.strip()
]
if GEMINI_MODEL not in GEMINI_MODEL_FALLBACKS:
    GEMINI_MODEL_FALLBACKS.insert(0, GEMINI_MODEL)

ALWAYS_LISTEN = _bool(os.getenv("ALWAYS_LISTEN"), True)
WAKE_WORD = os.getenv("WAKE_WORD", "cherry").lower()
VOICE_NAME = os.getenv("VOICE", "en-US-JennyNeural")
VOICE_ENABLED = _bool(os.getenv("VOICE_ENABLED"), True)
_paths_list = _paths(os.getenv("ALLOWED_PATHS"))
if _ROOT.resolve() not in [p.resolve() for p in _paths_list]:
    _paths_list.append(_ROOT.resolve())
ALLOWED_PATHS = _paths_list
CHERRY_IMAGES_DIR = Path.home() / "Pictures" / "Cherry"
PROJECT_ROOT = _ROOT
AUTO_SCROLL = _bool(os.getenv("AUTO_SCROLL"), True)
MAX_HISTORY_ITEMS = int(os.getenv("MAX_HISTORY_ITEMS", "40"))
