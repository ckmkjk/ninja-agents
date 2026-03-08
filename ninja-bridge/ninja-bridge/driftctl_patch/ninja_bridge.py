"""
ninja_bridge.py — driftctl ↔ Ninja Agents VS Code Extension bridge
Drop this file into your driftctl/ package directory.

Usage (from Claude Code agent or driftctl internals):
    from driftctl.ninja_bridge import ninja

    ninja.reading("scanner.py")           # KAGE unrolls scroll
    ninja.writing("email_service.py")     # KAGE inscribes
    ninja.running("npm run build")        # RYU sprints + shuriken
    ninja.thinking("Analyzing 3,847...") # HANA meditates + orbs
    ninja.error("2 errors in index.ts")  # KEN combat stance
    ninja.done("All tests passed!")       # TORA gold confetti
    ninja.idle()                          # all return to shadows
    ninja.broadcast("terminal","Custom detail")  # any type, raw
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Literal

# ── AGENT ROUTING ──────────────────────────────────────────────
# Maps activity type → default agent. Claude Code can override.
AGENT_MAP: dict[str, str] = {
    "file_read":  "kage",
    "file_write": "kage",
    "terminal":   "ryu",
    "thinking":   "hana",
    "error":      "ken",
    "complete":   "tora",
    "idle":       "all",
}

ActivityType = Literal[
    "file_read", "file_write", "terminal",
    "thinking", "error", "complete", "idle"
]


def _find_activity_file() -> Path:
    """
    Searches up from cwd for a .driftctl/ directory.
    Falls back to $HOME/.driftctl/ if none found in tree.
    This matches how driftctl itself resolves the state dir.
    """
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        candidate = parent / ".driftctl" / "ninja_activity.ndjson"
        if candidate.parent.exists():
            return candidate

    # Fallback: home dir (works even outside a driftctl project)
    fallback = Path.home() / ".driftctl" / "ninja_activity.ndjson"
    fallback.parent.mkdir(parents=True, exist_ok=True)
    return fallback


def _emit(
    activity_type: ActivityType,
    detail: str,
    agent_id: str | None = None,
) -> None:
    """
    Appends one NDJSON line to the activity file.
    The VS Code extension watches this file and tails new lines.

    Schema (one JSON object per line):
    {
        "type":      "file_read",
        "agentId":   "kage",
        "detail":    "Reading: scanner.py",
        "timestamp": 1711234567890,
        "seq":       42
    }
    """
    activity_file = _find_activity_file()

    # Read current seq number (last line's seq + 1)
    seq = 0
    try:
        if activity_file.exists() and activity_file.stat().st_size > 0:
            with open(activity_file, "rb") as f:
                # Seek to last line efficiently
                f.seek(-2, os.SEEK_END)
                while f.read(1) != b"\n":
                    try:
                        f.seek(-2, os.SEEK_CUR)
                    except OSError:
                        f.seek(0)
                        break
                last = f.readline().decode("utf-8", errors="ignore").strip()
                if last:
                    seq = json.loads(last).get("seq", 0) + 1
    except (OSError, json.JSONDecodeError, ValueError):
        seq = int(time.time() * 1000) % 100000  # safe fallback

    record = {
        "type":      activity_type,
        "agentId":   agent_id or AGENT_MAP.get(activity_type, "all"),
        "detail":    detail,
        "timestamp": int(time.time() * 1000),
        "seq":       seq,
    }

    try:
        with open(activity_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")
    except OSError:
        pass  # Never crash the agent over a visualization side-effect


def _trim_activity_file(max_lines: int = 500) -> None:
    """
    Keeps the activity file from growing unbounded.
    Trim to last N lines. Call this on driftctl checkpoint.
    """
    activity_file = _find_activity_file()
    if not activity_file.exists():
        return
    try:
        lines = activity_file.read_text("utf-8").splitlines(keepends=True)
        if len(lines) > max_lines:
            activity_file.write_text(
                "".join(lines[-max_lines:]), encoding="utf-8"
            )
    except OSError:
        pass


# ── PUBLIC API ─────────────────────────────────────────────────

class _NinjaBridge:
    """
    Singleton bridge. Import as:
        from driftctl.ninja_bridge import ninja
    """

    def reading(self, filename: str, agent: str | None = None) -> None:
        """KAGE unrolls scroll — agent is reading a file."""
        name = Path(filename).name if filename else filename
        _emit("file_read", f"Scanning: {name}", agent)

    def writing(self, filename: str, agent: str | None = None) -> None:
        """KAGE inscribes — agent is writing/saving a file."""
        name = Path(filename).name if filename else filename
        _emit("file_write", f"Inscribed: {name}", agent)

    def running(self, command: str, agent: str | None = None) -> None:
        """RYU sprints — agent is running a shell command."""
        short = command[:48] + "..." if len(command) > 48 else command
        _emit("terminal", f"$ {short}", agent)

    def thinking(self, detail: str = "Deep in meditation...", agent: str | None = None) -> None:
        """HANA meditates — agent is waiting/analyzing/calling an API."""
        _emit("thinking", detail, agent)

    def error(self, detail: str, agent: str | None = None) -> None:
        """KEN combat stance — agent hit an error or diagnostic."""
        _emit("error", detail, agent)

    def done(self, detail: str = "Mission accomplished!", agent: str | None = None) -> None:
        """TORA gold confetti — agent completed a task."""
        _emit("complete", detail, agent)

    def idle(self, agent: str = "all") -> None:
        """Return all (or one) ninja to idle watch state."""
        _emit("idle", "Watching shadows...", agent)

    def broadcast(
        self,
        activity_type: ActivityType,
        detail: str,
        agent: str | None = None,
    ) -> None:
        """Raw emit — any type, any agent. Escape hatch for custom flows."""
        _emit(activity_type, detail, agent)

    @property
    def activity_file(self) -> Path:
        """Returns the path to the current activity file (for debugging)."""
        return _find_activity_file()

    def trim(self, max_lines: int = 500) -> None:
        """Trim the activity file to avoid unbounded growth."""
        _trim_activity_file(max_lines)


ninja = _NinjaBridge()
