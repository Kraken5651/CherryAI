import time
from pathlib import Path
from urllib.parse import quote

import requests

from cherry import config

IMAGE_MARKER = "__CHERRY_IMAGE__"


def generate_image(prompt: str) -> str:
    """Free image generation via Pollinations (no API key)."""
    config.CHERRY_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    encoded = quote(prompt.strip())
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024"
    try:
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
    except requests.RequestException as e:
        return f"Image generation failed: {e}"

    name = f"cherry_{int(time.time())}.png"
    path = config.CHERRY_IMAGES_DIR / name
    path.write_bytes(resp.content)
    return f"{IMAGE_MARKER}{path}|Generated: {path.name}"
