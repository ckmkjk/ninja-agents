"""
cli_hooks.py — Drop-in hooks to wire ninja_bridge into driftctl's
existing CLI commands. Paste these into your driftctl/cli.py at
the call sites shown below.

INTEGRATION MAP:
  driftctl checkpoint  → ninja.done()
  driftctl drift       → ninja.thinking() + ninja.error() / ninja.done()
  driftctl handoff     → ninja.done()
  driftctl guard       → ninja.error() on violation
  driftctl session     → ninja.idle() on end

Search your cli.py for these strings and add the one-liners below.
"""

# ── WHERE TO INSERT IN cli.py ──────────────────────────────────

# 1. At the top of cli.py, add the import:
#    from driftctl.ninja_bridge import ninja

# ─────────────────────────────────────────────────────────────────
# 2. In your `checkpoint` command, after successfully writing state:
#
#    @cli.command()
#    def checkpoint():
#        """Save current session state."""
#        ...
#        state.save()                           # existing line
#        ninja.done("Checkpoint saved ✓")       # ← ADD THIS
#        ninja.trim()                           # ← ADD THIS (housekeeping)
#
# ─────────────────────────────────────────────────────────────────
# 3. In your `drift` command, before and after drift detection:
#
#    @cli.command()
#    def drift():
#        """Detect drift from last checkpoint."""
#        ninja.thinking("Running drift scan...")  # ← ADD THIS (before)
#        ...
#        result = detect_drift()                  # existing
#        if result.has_drift:
#            ninja.error(f"{len(result.drifted)} files drifted")  # ← ADD
#        else:
#            ninja.done("No drift detected")                       # ← ADD
#
# ─────────────────────────────────────────────────────────────────
# 4. In your `guard` command, when a rule is violated:
#
#    if violation:
#        ninja.error(f"Guard violated: {rule.name}")  # ← ADD
#
# ─────────────────────────────────────────────────────────────────
# 5. In your `handoff` command, on successful handoff generation:
#
#    ninja.done(f"Handoff ready for next agent")   # ← ADD
#
# ─────────────────────────────────────────────────────────────────


# ALTERNATIVE: If you want zero changes to cli.py, use Click's
# result callback mechanism to wrap all commands automatically:

import functools
import click
from driftctl.ninja_bridge import ninja  # type: ignore


COMMAND_NINJA_MAP = {
    "checkpoint": ("complete", "tora", "Checkpoint saved"),
    "drift":      ("thinking", "hana", "Drift scan running..."),
    "handoff":    ("complete", "tora", "Handoff generated"),
    "guard":      ("thinking", "ken",  "Guard rules checking..."),
    "init":       ("complete", "tora", "Project initialized"),
    "status":     ("thinking", "hana", "Reading project state..."),
}


def ninja_wrap(f, cmd_name: str):
    """
    Decorator that wraps any Click command with ninja activity events.
    Usage:
        checkpoint.callback = ninja_wrap(checkpoint.callback, "checkpoint")
    """
    atype, agent, detail = COMMAND_NINJA_MAP.get(
        cmd_name, ("thinking", "hana", f"Running {cmd_name}...")
    )

    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        ninja.broadcast(atype, detail, agent)  # type: ignore[arg-type]
        try:
            result = f(*args, **kwargs)
            return result
        except Exception as e:
            ninja.error(str(e)[:60])
            raise

    return wrapper
