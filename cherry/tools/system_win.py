import os
import shutil
import subprocess
from pathlib import Path

_APP_ALIASES = {
    "chrome": ["chrome", "google chrome"],
    "firefox": ["firefox"],
    "edge": ["msedge", "microsoft edge"],
    "vscode": ["code", "Code.exe"],
    "code": ["code", "Code.exe"],
    "notepad": ["notepad"],
    "calculator": ["calc"],
    "calc": ["calc"],
    "explorer": ["explorer"],
    "cmd": ["cmd"],
    "powershell": ["powershell"],
    "spotify": ["spotify"],
    "discord": ["discord", "Update.exe"],
}

_USER_FOLDERS = {
    "downloads": Path.home() / "Downloads",
    "documents": Path.home() / "Documents",
    "desktop": Path.home() / "Desktop",
    "pictures": Path.home() / "Pictures",
    "home": Path.home(),
}


def open_application(name: str) -> str:
    key = name.strip().lower()
    if key in _USER_FOLDERS:
        path = _USER_FOLDERS[key]
        os.startfile(path)  # type: ignore[attr-defined]
        return f"Opened {path}"

    candidates = _APP_ALIASES.get(key, [key])
    for exe in candidates:
        found = shutil.which(exe)
        if found:
            subprocess.Popen([found], shell=False)
            return f"Launched {found}"

    try:
        subprocess.Popen(f"start {key}", shell=True)
        return f"Started {key}"
    except OSError as e:
        return f"Could not open application '{name}': {e}"


def open_path(path: str) -> str:
    p = path.strip()
    low = p.lower()
    if low in _USER_FOLDERS:
        resolved = _USER_FOLDERS[low]
    else:
        resolved = Path(p).expanduser().resolve()

    if not resolved.exists():
        return f"Path does not exist: {resolved}"
    os.startfile(str(resolved))  # type: ignore[attr-defined]
    return f"Opened {resolved}"
