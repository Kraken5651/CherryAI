from __future__ import annotations

import os
from pathlib import Path

import customtkinter as ctk
from PIL import Image

from cherry import config
from cherry.ui import theme as T


class ImageLibraryPanel(ctk.CTkFrame):
    """Grid of all generated images in Pictures/Cherry."""

    def __init__(self, master, **kwargs) -> None:
        super().__init__(master, fg_color=T.BG, **kwargs)
        self._image_refs: list[ctk.CTkImage] = []

        top = ctk.CTkFrame(self, fg_color=T.PANEL, corner_radius=0)
        top.pack(fill="x")
        ctk.CTkLabel(
            top,
            text="◈ IMAGE LIBRARY",
            font=ctk.CTkFont(family="Consolas", size=16, weight="bold"),
            text_color=T.CYAN,
        ).pack(side="left", padx=16, pady=12)
        ctk.CTkButton(
            top,
            text="Refresh",
            width=90,
            fg_color=T.BTN_PRIMARY,
            hover_color=T.BTN_PRIMARY_HOVER,
            border_width=1,
            border_color=T.CYAN,
            command=self.refresh,
        ).pack(side="right", padx=12, pady=8)
        ctk.CTkLabel(
            top,
            text=str(config.CHERRY_IMAGES_DIR),
            font=ctk.CTkFont(size=10),
            text_color=T.MUTED,
        ).pack(side="right", padx=8)

        self._scroll = ctk.CTkScrollableFrame(
            self,
            fg_color=T.BG,
            scrollbar_button_color=T.MAGENTA,
            scrollbar_button_hover_color=T.PINK,
        )
        self._scroll.pack(fill="both", expand=True, padx=8, pady=8)
        self._grid = ctk.CTkFrame(self._scroll, fg_color="transparent")
        self._grid.pack(fill="both", expand=True)

        self.refresh()

    def refresh(self) -> None:
        for w in self._grid.winfo_children():
            w.destroy()
        self._image_refs.clear()

        folder = config.CHERRY_IMAGES_DIR
        folder.mkdir(parents=True, exist_ok=True)
        files = sorted(
            folder.glob("*.png"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not files:
            ctk.CTkLabel(
                self._grid,
                text="No images yet.\nAsk Cherry to generate one.",
                text_color=T.MUTED,
                font=ctk.CTkFont(size=13),
            ).pack(pady=40)
            return

        cols = 2
        for i, path in enumerate(files):
            row, col = divmod(i, cols)
            self._add_thumb(path, row, col)

    def _add_thumb(self, path: Path, row: int, col: int) -> None:
        card = ctk.CTkFrame(
            self._grid,
            fg_color=T.SURFACE,
            corner_radius=10,
            border_width=1,
            border_color=T.BORDER,
        )
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")

        try:
            pil = Image.open(path)
            w, h = pil.size
            tw, th = 220, 165
            scale = min(tw / w, th / h, 1.0)
            size = (max(1, int(w * scale)), max(1, int(h * scale)))
            cimg = ctk.CTkImage(pil, size=size)
            self._image_refs.append(cimg)
            ctk.CTkLabel(card, image=cimg, text="").pack(padx=6, pady=6)
        except OSError:
            ctk.CTkLabel(card, text="(unreadable)", text_color=T.MUTED).pack(
                padx=8, pady=20
            )

        name = path.name
        if len(name) > 28:
            name = name[:25] + "..."
        ctk.CTkLabel(
            card,
            text=name,
            font=ctk.CTkFont(size=10),
            text_color=T.MUTED,
        ).pack(padx=6, pady=(0, 4))

        btns = ctk.CTkFrame(card, fg_color="transparent")
        btns.pack(fill="x", padx=6, pady=(0, 8))
        ctk.CTkButton(
            btns,
            text="Open",
            width=70,
            height=28,
            fg_color=T.BTN_PRIMARY,
            hover_color=T.BTN_PRIMARY_HOVER,
            command=lambda p=path: os.startfile(str(p)),  # type: ignore[attr-defined]
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            btns,
            text="Folder",
            width=70,
            height=28,
            fg_color=T.BTN_ACCENT,
            hover_color=T.BTN_ACCENT_HOVER,
            command=lambda: os.startfile(str(config.CHERRY_IMAGES_DIR)),  # type: ignore[attr-defined]
        ).pack(side="left", padx=2)
