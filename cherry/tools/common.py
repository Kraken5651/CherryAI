from pathlib import Path
from cherry import config

def resolve_allowed_path(path: str) -> Path | None:
    """Check if a path is within the ALLOWED_PATHS sandbox."""
    try:
        resolved = Path(path).expanduser().resolve()
    except (OSError, ValueError):
        return None
    
    # Check against allowed roots
    for root in config.ALLOWED_PATHS:
        try:
            resolved.relative_to(root.resolve())
            return resolved
        except ValueError:
            continue
    return None
