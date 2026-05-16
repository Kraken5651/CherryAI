import re
import subprocess
from pathlib import Path

from cherry import config

_BLOCKED = re.compile(
    r"(\brm\b|\bdel\b|\berase\b|\bformat\b|\bshutdown\b|\brestart\b|\breg\s+"
    r"|\bmkfs\b|\bdd\b|\b>:|\|\s*rm\b|remove-item\s+-recurse|-rf\b|--force\s+push)",
    re.IGNORECASE,
)

_ALLOWED_PREFIXES = (
    "git ",
    "python ",
    "py ",
    "pip ",
    "dir",
    "cd ",
    "type ",
    "echo ",
    "npm ",
    "node ",
    "pytest",
    "cargo ",
    "go ",
    "dotnet ",
    "ls",
    "tree ",
    "where ",
    "which ",
)


def _cwd_allowed(cwd: str | None) -> Path | None:
    if not cwd:
        return config.PROJECT_ROOT
    p = Path(cwd).expanduser().resolve()
    for root in config.ALLOWED_PATHS:
        try:
            p.relative_to(root.resolve())
            return p
        except ValueError:
            continue
    return None


def run_command(command: str, cwd: str | None = None) -> str:
    cmd = command.strip()
    if _BLOCKED.search(cmd):
        return "Blocked: command looks destructive. Refused for safety."
    if not any(cmd.lower().startswith(p) for p in _ALLOWED_PREFIXES):
        return (
            "Blocked: command not on allowlist. Allowed prefixes: "
            + ", ".join(_ALLOWED_PREFIXES)
        )
    work = _cwd_allowed(cwd)
    if work is None:
        return f"Working directory not allowed: {cwd}"
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=str(work),
            capture_output=True,
            text=True,
            timeout=60,
        )
    except subprocess.TimeoutExpired:
        return "Command timed out after 60 seconds."
    except OSError as e:
        return f"Run error: {e}"
    out = (result.stdout or "") + (result.stderr or "")
    if len(out) > 12_000:
        out = out[:12_000] + "\n... (output truncated)"
    status = f"exit {result.returncode}"
    return f"{status}\n{out}" if out.strip() else status
