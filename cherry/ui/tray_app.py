from __future__ import annotations

import sys
import threading

import customtkinter as ctk
from pystray import Icon, Menu, MenuItem

from cherry import config
from cherry.brain import Brain
from cherry.ui.chat_window import ChatWindow
from cherry.ui.icons import apply_window_icon, get_tray_image
from cherry.voice import VoiceController


class TrayApp:
    def __init__(self) -> None:
        self.brain = Brain()
        self.root = ctk.CTk()
        self.root.withdraw()
        self.root.after(50, lambda: apply_window_icon(self.root))

        self.chat: ChatWindow | None = None
        self.voice = VoiceController(
            self.brain,
            on_status=self._voice_status,
            on_reply=self._voice_reply,
            on_image=self._on_image,
        )
        self._icon: Icon | None = None
        self._tray_thread: threading.Thread | None = None

    def _interrupt(self) -> None:
        self.voice.interrupt()

    def _on_image(self, path: str) -> None:
        if self.chat and self.chat.winfo_exists():
            self.root.after(0, lambda: self.chat._show_image(path))

    def _voice_status(self, msg: str) -> None:
        if self.chat and self.chat.winfo_exists():
            self.root.after(
                0,
                lambda m=msg: self.chat._add_message("Voice", m, is_user=False),
            )

    def _voice_reply(self, user: str, reply: str) -> None:
        if self.chat and self.chat.winfo_exists():
            def update() -> None:
                self.chat._add_message("You", user, is_user=True)
                self.chat._add_message("Cherry", reply, is_user=False)

            self.root.after(0, update)

    def _ensure_chat(self) -> ChatWindow:
        if self.chat is None or not self.chat.winfo_exists():
            self.chat = ChatWindow(
                self.root,
                self.brain,
                voice=self.voice,
                on_close=lambda: None,
                on_stop=self._interrupt,
            )
        return self.chat

    def open_chat(self) -> None:
        self.root.after(0, lambda: self._ensure_chat().show())

    def _toggle_voice(self, _icon=None, _item=None) -> None:
        on = self.voice.toggle_enabled()
        label = "on" if on else "off"
        if self.chat and self.chat.winfo_exists():
            self.root.after(
                0,
                lambda: self.chat._add_message(
                    "Cherry", f"Voice {label}.", is_user=False
                ),
            )

    def _toggle_always(self, _icon=None, _item=None) -> None:
        on = self.voice.toggle_always_listen()
        mode = "always listen" if on else f"wake word '{config.WAKE_WORD}'"
        if self.chat and self.chat.winfo_exists():
            self.root.after(
                0,
                lambda: self.chat._add_message(
                    "Cherry", f"Mode: {mode}.", is_user=False
                ),
            )

    def _quit(self, _icon=None, _item=None) -> None:
        self.voice.stop()
        if self._icon:
            self._icon.stop()
        self.root.after(0, self.root.quit)

    def _run_tray(self) -> None:
        menu = Menu(
            MenuItem("Open chat", self.open_chat, default=True),
            MenuItem("Voice on/off", self._toggle_voice),
            MenuItem("Always listen / wake word", self._toggle_always),
            Menu.SEPARATOR,
            MenuItem("Quit", self._quit),
        )
        self._icon = Icon(
            "Cherry",
            get_tray_image(),
            "Cherry AI",
            menu,
        )
        self._icon.run()

    def run(self) -> None:
        self._tray_thread = threading.Thread(target=self._run_tray, daemon=True)
        self._tray_thread.start()
        self.open_chat()
        # Defer mic loop so UI opens faster
        self.root.after(800, self.voice.start)
        self.root.mainloop()
        sys.exit(0)
