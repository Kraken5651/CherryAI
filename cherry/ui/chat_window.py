from __future__ import annotations

import threading
import tkinter as tk
from pathlib import Path
from typing import TYPE_CHECKING, Callable

import customtkinter as ctk
from PIL import Image

from cherry import config
from cherry.ui.icons import apply_window_icon
from cherry.ui.image_library import ImageLibraryPanel
from cherry.ui import theme as T

if TYPE_CHECKING:
    from cherry.brain import Brain
    from cherry.voice import VoiceController


def _copyable_text(parent: ctk.CTkFrame, text: str, *, bg: str, fg: str) -> tk.Text:
    """Read-only Text widget — select and Ctrl+C to copy."""
    lines = max(1, text.count("\n") + 1)
    height = min(24, lines + 1)
    txt = tk.Text(
        parent,
        wrap="word",
        height=height,
        width=52,
        bg=bg,
        fg=fg,
        insertbackground=fg,
        relief="flat",
        borderwidth=0,
        highlightthickness=0,
        font=T.FONT_MONO,
        padx=6,
        pady=4,
        exportselection=True,
    )
    txt.insert("1.0", text)
    txt.configure(cursor="xterm")

    def _block_edit(event: tk.Event) -> str | None:
        if event.state & 0x4 and event.keysym.lower() in ("c", "a", "x"):
            return None
        if event.keysym in (
            "Left",
            "Right",
            "Up",
            "Down",
            "Shift_L",
            "Shift_R",
            "Control_L",
            "Control_R",
            "Home",
            "End",
            "Prior",
            "Next",
        ):
            return None
        if event.keysym in ("Return", "BackSpace", "Delete"):
            return "break"
        if event.char and event.char.isprintable():
            return "break"
        return None

    txt.bind("<Key>", _block_edit)
    return txt


class ChatWindow(ctk.CTkToplevel):
    def __init__(
        self,
        master: ctk.CTk,
        brain: Brain,
        voice: VoiceController | None = None,
        on_close: Callable[[], None] | None = None,
        on_stop: Callable[[], None] | None = None,
    ) -> None:
        super().__init__(master)
        self.brain = brain
        self.voice = voice
        self._on_close = on_close
        self._on_stop = on_stop
        self._busy = False
        self._worker: threading.Thread | None = None
        self._cancel = threading.Event()
        self._image_refs: list[ctk.CTkImage] = []
        self._view = "chat"
        self._auto_scroll = config.AUTO_SCROLL

        self.title("Cherry AI")
        self.geometry("900x720")
        self.minsize(640, 520)
        self.configure(fg_color=T.BG)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("dark-blue")

        self.after(50, lambda: apply_window_icon(self))

        shell = ctk.CTkFrame(self, fg_color=T.BG, corner_radius=0)
        shell.pack(fill="both", expand=True)

        # --- Sidebar ---
        sidebar = ctk.CTkFrame(
            shell, width=88, fg_color=T.SIDEBAR, corner_radius=0, border_width=1, border_color=T.BORDER
        )
        sidebar.pack(side="left", fill="y")
        sidebar.pack_propagate(False)

        ctk.CTkLabel(
            sidebar,
            text="CH",
            font=ctk.CTkFont(family="Consolas", size=22, weight="bold"),
            text_color=T.MAGENTA,
        ).pack(pady=(16, 20))

        self._btn_chat = self._nav_btn(sidebar, "Chat", self._show_chat)
        self._btn_chat.pack(pady=4)
        self._btn_library = self._nav_btn(sidebar, "Library", self._show_library)
        self._btn_library.pack(pady=4)

        # --- Main ---
        main = ctk.CTkFrame(shell, fg_color=T.BG, corner_radius=0)
        main.pack(side="left", fill="both", expand=True)

        header = ctk.CTkFrame(
            main, fg_color=T.PANEL, corner_radius=0, height=48, border_width=1, border_color=T.BORDER
        )
        header.pack(fill="x")
        header.pack_propagate(False)
        self._header_title = ctk.CTkLabel(
            header,
            text="CHERRY // CHAT",
            font=ctk.CTkFont(family="Consolas", size=15, weight="bold"),
            text_color=T.CYAN,
        )
        self._header_title.pack(side="left", padx=16, pady=10)
        self._status = ctk.CTkLabel(
            header,
            text="◉ READY",
            font=ctk.CTkFont(family="Consolas", size=11),
            text_color=T.MUTED,
        )
        self._status.pack(side="right", padx=8)
        self._autoscroll_var = tk.BooleanVar(value=self._auto_scroll)
        self._autoscroll_sw = ctk.CTkSwitch(
            header,
            text="Auto-scroll",
            variable=self._autoscroll_var,
            command=self._toggle_autoscroll,
            font=ctk.CTkFont(size=11),
            text_color=T.MUTED,
            progress_color=T.CYAN,
            button_color=T.MAGENTA,
            button_hover_color=T.PINK,
        )
        self._autoscroll_sw.pack(side="right", padx=8)

        self._content = ctk.CTkFrame(main, fg_color=T.BG, corner_radius=0)
        self._content.pack(fill="both", expand=True)

        self._chat_frame = ctk.CTkFrame(self._content, fg_color=T.BG)
        self._scroll = ctk.CTkScrollableFrame(
            self._chat_frame,
            fg_color=T.BG,
            scrollbar_button_color=T.MAGENTA,
            scrollbar_button_hover_color=T.PINK,
        )
        self._scroll.pack(fill="both", expand=True, padx=8, pady=8)

        self._library_frame = ImageLibraryPanel(self._content)
        self._chat_frame.pack(fill="both", expand=True)

        # Input (chat only)
        self._input_wrap = ctk.CTkFrame(
            main, fg_color=T.PANEL, corner_radius=0, border_width=1, border_color=T.BORDER
        )
        self._input_wrap.pack(fill="x", side="bottom")

        row = ctk.CTkFrame(self._input_wrap, fg_color="transparent")
        row.pack(fill="x", padx=10, pady=10)

        self._entry = ctk.CTkEntry(
            row,
            placeholder_text="Message Cherry...",
            height=42,
            fg_color=T.SURFACE,
            border_color=T.CYAN,
            border_width=1,
            text_color=T.TEXT,
            placeholder_text_color=T.MUTED,
            font=ctk.CTkFont(family="Consolas", size=12),
        )
        self._entry.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self._entry.bind("<Return>", lambda _e: self._send())

        self._stop_btn = ctk.CTkButton(
            row,
            text="Stop",
            width=58,
            height=42,
            fg_color=T.BTN_STOP,
            hover_color=T.BTN_STOP_HOVER,
            border_width=1,
            border_color=T.MAGENTA,
            command=self._stop,
            state="disabled",
        )
        self._stop_btn.pack(side="right", padx=(0, 4))

        ctk.CTkButton(
            row,
            text="Send",
            width=64,
            height=42,
            fg_color=T.BTN_PRIMARY,
            hover_color=T.BTN_PRIMARY_HOVER,
            border_width=1,
            border_color=T.CYAN,
            command=self._send,
        ).pack(side="right", padx=(0, 4))

        if voice:
            ctk.CTkButton(
                row,
                text="Mic",
                width=52,
                height=42,
                fg_color=T.BTN_ACCENT,
                hover_color=T.BTN_ACCENT_HOVER,
                border_width=1,
                border_color=T.MAGENTA,
                command=self._mic_once,
            ).pack(side="right", padx=(0, 4))

        hint = ctk.CTkLabel(
            self._input_wrap,
            text="Tip: select message text and press Ctrl+C to copy",
            font=ctk.CTkFont(size=10),
            text_color=T.MUTED,
        )
        hint.pack(pady=(0, 6))

        self.protocol("WM_DELETE_WINDOW", self._close)
        self._highlight_nav("chat")
        self._add_message(
            "Cherry",
            "Systems online. Chat, generate images, or open Library for past art. "
            "Ctrl+C works on any message. Stop cuts me off mid-reply.",
            is_user=False,
        )

    def _nav_btn(self, parent: ctk.CTkFrame, label: str, cmd: Callable[[], None]) -> ctk.CTkButton:
        return ctk.CTkButton(
            parent,
            text=label,
            width=72,
            height=36,
            fg_color="transparent",
            hover_color=T.SURFACE,
            text_color=T.MUTED,
            font=ctk.CTkFont(family="Consolas", size=11, weight="bold"),
            command=cmd,
        )

    def _highlight_nav(self, view: str) -> None:
        self._view = view
        active = {"fg_color": T.SURFACE, "text_color": T.CYAN, "border_width": 1, "border_color": T.CYAN}
        idle = {"fg_color": "transparent", "text_color": T.MUTED, "border_width": 0}
        self._btn_chat.configure(**(active if view == "chat" else idle))
        self._btn_library.configure(**(active if view == "library" else idle))

    def _show_chat(self) -> None:
        self._library_frame.pack_forget()
        self._chat_frame.pack(fill="both", expand=True)
        self._input_wrap.pack(fill="x", side="bottom")
        self._header_title.configure(text="CHERRY // CHAT")
        self._highlight_nav("chat")

    def _show_library(self) -> None:
        self._chat_frame.pack_forget()
        self._input_wrap.pack_forget()
        self._library_frame.pack(fill="both", expand=True)
        self._library_frame.refresh()
        self._header_title.configure(text="CHERRY // LIBRARY")
        self._highlight_nav("library")

    def _close(self) -> None:
        self.withdraw()
        if self._on_close:
            self._on_close()

    def show(self) -> None:
        self.deiconify()
        self.lift()
        apply_window_icon(self)
        self.focus_force()
        if self._view == "chat":
            self._entry.focus_set()

    def _toggle_autoscroll(self) -> None:
        self._auto_scroll = bool(self._autoscroll_var.get())

    def _scroll_to_bottom(self) -> None:
        if not self._auto_scroll:
            return
        try:
            self.update_idletasks()
            self._scroll._parent_canvas.yview_moveto(1.0)
        except Exception:
            pass

    def _set_status(self, text: str) -> None:
        self._status.configure(text=text)

    def _set_busy(self, busy: bool) -> None:
        self._busy = busy
        self._stop_btn.configure(state="normal" if busy else "disabled")
        self._set_status("◉ THINKING..." if busy else "◉ READY")

    def _stop(self) -> None:
        self._cancel.set()
        self.brain.request_cancel()
        if self._on_stop:
            self._on_stop()
        self._set_status("◉ STOPPING...")

    def _add_message(
        self,
        who: str,
        text: str,
        *,
        is_user: bool,
        image_path: str | None = None,
    ) -> None:
        if who.lower() == "tool":
            bubble_color = T.TOOL_BUBBLE
            name_color = T.YELLOW
            border = T.BORDER
        elif is_user:
            bubble_color = T.USER_BUBBLE
            name_color = T.MAGENTA
            border = T.MAGENTA
        else:
            bubble_color = T.BOT_BUBBLE
            name_color = T.CYAN
            border = T.CYAN

        align = "e" if is_user else "w"
        outer = ctk.CTkFrame(self._scroll, fg_color="transparent")
        outer.pack(fill="x", pady=6, anchor=align)

        bubble = ctk.CTkFrame(
            outer,
            fg_color=bubble_color,
            corner_radius=8,
            border_width=1,
            border_color=border,
        )
        bubble.pack(anchor=align, padx=6)

        ctk.CTkLabel(
            bubble,
            text=f"▸ {who.upper()}",
            font=ctk.CTkFont(family="Consolas", size=10, weight="bold"),
            text_color=name_color,
            anchor="w",
        ).pack(anchor="w", padx=10, pady=(8, 0))

        if text.strip():
            tf = ctk.CTkFrame(bubble, fg_color=bubble_color)
            tf.pack(anchor="w", fill="x", padx=6, pady=4)
            _copyable_text(tf, text, bg=bubble_color, fg=T.TEXT).pack(anchor="w", fill="x")

        if image_path and Path(image_path).is_file():
            try:
                pil = Image.open(image_path)
                w, h = pil.size
                max_w, max_h = 440, 300
                scale = min(max_w / w, max_h / h, 1.0)
                size = (int(w * scale), int(h * scale))
                cimg = ctk.CTkImage(pil, size=size)
                self._image_refs.append(cimg)
                if len(self._image_refs) > 30:
                    self._image_refs = self._image_refs[-20:]
                ctk.CTkLabel(bubble, image=cimg, text="").pack(padx=8, pady=(0, 10))
            except OSError:
                ctk.CTkLabel(
                    bubble,
                    text=f"(Could not load: {image_path})",
                    text_color=T.MUTED,
                ).pack(padx=12, pady=8)

        self.after_idle(self._scroll_to_bottom)

    def _append(self, who: str, text: str) -> None:
        self.after(
            0,
            lambda: self._add_message(who, text, is_user=(who.lower() == "you")),
        )

    def _show_image(self, path: str) -> None:
        def show() -> None:
            self._add_message(
                "Cherry",
                "Image generated — also saved to Library.",
                is_user=False,
                image_path=path,
            )
            if self._library_frame.winfo_ismapped():
                self._library_frame.refresh()

        self.after(0, show)

    def _send(self) -> None:
        text = self._entry.get().strip()
        if not text or self._busy:
            return
        self._entry.delete(0, tk.END)
        if self._view != "chat":
            self._show_chat()
        self._add_message("You", text, is_user=True)
        self._run_chat(text, from_voice=False)

    def _mic_once(self) -> None:
        if not self.voice or self._busy:
            return
        self._set_busy(True)
        self._set_status("◉ LISTENING...")
        threading.Thread(target=self._mic_worker, daemon=True).start()

    def _mic_worker(self) -> None:
        transcript = self.voice.listen_once() if self.voice else None
        self.after(0, lambda: self._on_mic_result(transcript))

    def _on_mic_result(self, transcript: str | None) -> None:
        if not transcript:
            self._set_busy(False)
            self._add_message("Cherry", "Could not hear you. Try again.", is_user=False)
            return
        self._add_message("You", transcript, is_user=True)
        self._run_chat(transcript, from_voice=True)

    def _run_chat(self, text: str, *, from_voice: bool) -> None:
        self._cancel.clear()
        self.brain.clear_cancel()
        self._set_busy(True)

        def on_model(m: str) -> None:
            self.after(0, lambda: self._set_status(f"◉ {m}"))

        def worker() -> None:
            try:
                reply = self.brain.chat(
                    text,
                    from_voice=from_voice,
                    cancel_event=self._cancel,
                    on_model_try=on_model,
                    on_tool_status=lambda s: self.after(
                        0, lambda m=s: self._add_message("Tool", m, is_user=False)
                    ),
                    on_image=lambda p: self._show_image(p),
                )
            except Exception as e:
                reply = f"Error: {e}"
            self.after(0, lambda: self._finish_reply(reply, from_voice))

        self._worker = threading.Thread(target=worker, daemon=True)
        self._worker.start()

    def _finish_reply(self, reply: str, from_voice: bool) -> None:
        self._set_busy(False)
        self._add_message("Cherry", reply if reply != "Stopped." else "Stopped.", is_user=False)
        if from_voice and self.voice and reply != "Stopped.":
            threading.Thread(target=self.voice.speak, args=(reply,), daemon=True).start()
