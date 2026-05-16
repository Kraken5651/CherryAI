"""Start Cherry AI (tray + chat + voice)."""

import sys
import traceback
from pathlib import Path

import tkinter.messagebox as mb

from cherry import config

_LOG = Path(__file__).resolve().parent / "logs" / "cherry-error.log"


def _log_crash(exc: BaseException) -> None:
    _LOG.parent.mkdir(parents=True, exist_ok=True)
    _LOG.write_text(
        traceback.format_exc(),
        encoding="utf-8",
    )


def main() -> None:
    if not config.GOOGLE_API_KEYS:
        mb.showerror(
            "Cherry AI",
            "No Gemini API key set.\n\n"
            "Add GOOGLE_API_KEY in .env (and optional GOOGLE_API_KEYS for extras)\n"
            "https://aistudio.google.com/apikey",
        )
        sys.exit(1)
    try:
        from cherry.ui.tray_app import TrayApp

        app = TrayApp()
        app.run()
    except Exception as exc:
        _log_crash(exc)
        mb.showerror(
            "Cherry AI — startup error",
            f"{exc}\n\nDetails saved to:\n{_LOG}",
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
