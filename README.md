# Cherry AI

Personal Jarvis-style assistant for Windows: voice + text chat, Gemini brain, tools for web, apps, coding, and free image generation.

## Features

- **System tray** — cherry icon; click or *Open chat* for the text window
- **Voice** — Google speech recognition + **Edge TTS** female voice (`en-US-JennyNeural`)
- **Always listening** (default) — or wake word mode via `.env` / tray toggle
- **Gemini** — chat, coding, tool use (free tier)
- **Tools** — open sites/apps/folders, play music, read/write files, safe shell commands, free Pollinations images (shown in chat)
- **Stop button** — interrupt the model or voice mid-response
- **Desktop shortcut** — run `install_desktop_shortcut.ps1` or use **Cherry AI** on your desktop

## Setup (Windows)

```powershell
cd "K:\THE PROJECTS\CherryAI"
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

If **PyAudio** fails to install:

```powershell
pip install pipwin
pipwin install pyaudio
```

Copy environment file and add your [Google AI Studio](https://aistudio.google.com/apikey) key:

```powershell
copy .env.example .env
# Edit .env — set GOOGLE_API_KEY=...
```

## Run

```powershell
python run.py
```

Or double-click **Cherry AI** on the desktop / `Launch Cherry.bat`.

Tray icon (cherry) → chat window. **Send** / **Mic** / **Stop** in the input bar.

## Desktop shortcut

```powershell
powershell -ExecutionPolicy Bypass -File install_desktop_shortcut.ps1
```

Creates `Cherry AI.lnk` on your desktop.

## Configuration (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | — | Required for Gemini |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Primary model id |
| `GEMINI_MODEL_FALLBACKS` | 2.5-flash, 2.0-flash-lite, 1.5-flash | Auto-switch if quota hit |
| `ALWAYS_LISTEN` | `true` | `false` = require wake word |
| `WAKE_WORD` | `cherry` | Substring to activate (wake mode) |
| `VOICE` | `en-US-JennyNeural` | Edge TTS voice |
| `VOICE_ENABLED` | `true` | Start with mic loop on |
| `ALLOWED_PATHS` | project + Documents | Semicolon-separated roots for file/shell tools |

## Free tier notes

- **Gemini (chat/coding)** — free tier with daily/minute limits; Cherry auto-tries fallback models if one is exhausted
- **Images** — **100% free**, no API key — uses [Pollinations](https://pollinations.ai/) (community service; quality/speed vary; not for commercial use at scale)
- **Voice** — Edge TTS + Google STT are free (internet required)

## Project layout

```
cherry/
  brain.py      # Gemini + tools
  voice.py      # STT + Edge TTS
  config.py
  tools/        # browser, system, files, shell, images
  ui/           # tray + chat window
run.py          # entry point
musicLibrary.py # song URLs for play_music
```

## Safety

File and shell tools only work under `ALLOWED_PATHS`. Destructive shell patterns are blocked.
