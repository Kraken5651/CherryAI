import webbrowser

import musicLibrary

_SITES = {
    "google": "https://google.com",
    "facebook": "https://facebook.com",
    "youtube": "https://youtube.com",
    "instagram": "https://instagram.com",
    "linkedin": "https://linkedin.com",
    "chatgpt": "https://chat.openai.com/",
    "chat": "https://chat.openai.com/",
    "github": "https://github.com",
    "gmail": "https://mail.google.com/",
    "stackoverflow": "https://stackoverflow.com/",
}


def open_website(target: str) -> str:
    key = target.strip().lower().replace("open ", "").strip()
    if key.startswith("http://") or key.startswith("https://"):
        url = key
    else:
        url = _SITES.get(key)
        if not url:
            return f"Unknown site '{target}'. Known: {', '.join(sorted(_SITES))}"
    webbrowser.open(url)
    return f"Opened {url}"


def play_music(song: str) -> str:
    key = song.strip().lower()
    link = musicLibrary.music.get(key)
    if not link:
        known = ", ".join(musicLibrary.music.keys()) or "none"
        return f"Song '{song}' not in library. Known: {known}"
    webbrowser.open(link)
    return f"Playing {key}"
