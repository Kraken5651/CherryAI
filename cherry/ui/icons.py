"""Cherry-themed icons for tray and window."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS_DIR = Path(__file__).resolve().parent.parent.parent / "assets"
ICO_PATH = ASSETS_DIR / "cherry.ico"
PNG_PATH = ASSETS_DIR / "cherry.png"


def _draw_cherry(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 64.0

    # Neon glow behind cherries
    d.ellipse((6 * s, 20 * s, 58 * s, 60 * s), fill=(0, 245, 255, 35))

    d.rectangle((30 * s, 4 * s, 34 * s, 22 * s), fill=(0, 200, 120, 255))
    d.line(
        (32 * s, 22 * s, 24 * s, 30 * s),
        fill=(0, 255, 140, 255),
        width=max(2, int(2 * s)),
    )

    d.ellipse((10 * s, 26 * s, 34 * s, 54 * s), fill=(220, 20, 80, 255))
    d.ellipse((16 * s, 32 * s, 24 * s, 40 * s), fill=(255, 120, 180, 160))

    d.ellipse((30 * s, 28 * s, 54 * s, 56 * s), fill=(255, 40, 120, 255))
    d.ellipse((38 * s, 34 * s, 46 * s, 42 * s), fill=(255, 180, 220, 180))

    return img


def ensure_assets(*, force: bool = False) -> Path:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    base = _draw_cherry(256)
    if force or not PNG_PATH.exists():
        base.save(PNG_PATH, format="PNG")
    if force or not ICO_PATH.exists():
        base.save(
            ICO_PATH,
            format="ICO",
            sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        )
    return ICO_PATH


def get_tray_image() -> Image.Image:
    ensure_assets()
    return _draw_cherry(64)


def get_window_icon_path() -> Path:
    return ensure_assets()


def apply_window_icon(window: tk.Misc) -> None:
    """Set taskbar/title-bar icon on Tk / CTk windows (Windows)."""
    ensure_assets(force=False)
    holder = window
    if hasattr(window, "tk"):
        holder = window
    try:
        photo = tk.PhotoImage(file=str(PNG_PATH))
        holder.iconphoto(True, photo)
        if not hasattr(holder, "_cherry_icon_refs"):
            holder._cherry_icon_refs = []  # type: ignore[attr-defined]
        holder._cherry_icon_refs.append(photo)  # type: ignore[attr-defined]
    except tk.TclError:
        pass
    try:
        holder.iconbitmap(str(ICO_PATH))
    except tk.TclError:
        pass
