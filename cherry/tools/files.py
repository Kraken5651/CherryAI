from .common import resolve_allowed_path

_MAX_READ = 80_000


def read_file(path: str) -> str:
    resolved = resolve_allowed_path(path)
    if not resolved:
        return f"Access denied or invalid path: {path}"
    if not resolved.is_file():
        return f"Not a file: {resolved}"
    try:
        text = resolved.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return "File is not UTF-8 text."
    except OSError as e:
        return f"Read error: {e}"
    if len(text) > _MAX_READ:
        return text[:_MAX_READ] + f"\n\n... truncated ({len(text)} chars total)"
    return text


def write_file(path: str, content: str) -> str:
    resolved = resolve_allowed_path(path)
    if not resolved:
        return f"Access denied or invalid path: {path}"
    try:
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(content, encoding="utf-8")
    except OSError as e:
        return f"Write error: {e}"
    return f"Wrote {len(content)} bytes to {resolved}"


def list_dir(path: str) -> str:
    resolved = resolve_allowed_path(path)
    if not resolved:
        return f"Access denied or invalid path: {path}"
    if not resolved.is_dir():
        return f"Not a directory: {resolved}"
    try:
        entries = sorted(resolved.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError as e:
        return f"List error: {e}"
    lines = [f"{'[DIR]' if e.is_dir() else '[FILE]'} {e.name}" for e in entries[:200]]
    if len(entries) > 200:
        lines.append(f"... and {len(entries) - 200} more")
    return "\n".join(lines) if lines else "(empty directory)"
