# 🥷 Ninja Agents — Claude Code Integration

This file tells Claude Code how to drive the Ninja Village VS Code extension
autonomously. Include it in your project root or paste into your CLAUDE.md.

---

## What This Does

Every significant action you take should be announced to the Ninja Village
so the sidebar visualization stays in sync with your actual work.

The bridge is a one-liner import. Use it constantly. It's a no-op if the
VS Code extension isn't running — it will never crash your agent.

---

## Setup (one time)

```python
# driftctl already installed. Copy ninja_bridge.py into the driftctl package:
# cp ninja_bridge.py $(python -c "import driftctl; print(driftctl.__path__[0])")/ninja_bridge.py
```

---

## Import

```python
from driftctl.ninja_bridge import ninja
```

---

## Required Calls — Do These Every Time

### Reading a file
```python
ninja.reading("scanner.py")
content = open("scanner.py").read()
```

### Writing a file
```python
ninja.writing("email_service.py")
with open("email_service.py", "w") as f:
    f.write(new_content)
```

### Running a shell command
```python
ninja.running("npm run compile")
subprocess.run(["npm", "run", "compile"], ...)
```

### Waiting / analyzing / calling an API
```python
ninja.thinking("Analyzing Tier 1 signals...")
result = claude_api.analyze(signals)
```

### Error encountered
```python
try:
    ...
except Exception as e:
    ninja.error(str(e)[:60])
    raise
```

### Task complete
```python
ninja.done("Phase 1 options layer complete")
```

### Between tasks — return to idle
```python
ninja.idle()
```

---

## Agent Routing (which ninja animates for which call)

| Method          | Ninja | Visual                          |
|-----------------|-------|---------------------------------|
| ninja.reading() | KAGE  | Arms extend, gold kanji float   |
| ninja.writing() | KAGE  | Arms extend, gold kanji float   |
| ninja.running() | RYU   | Sprints, throws shuriken        |
| ninja.thinking()| HANA  | Levitates, energy orbs orbit    |
| ninja.error()   | KEN   | Combat stance, red sparks       |
| ninja.done()    | TORA  | Arms raised, gold confetti      |
| ninja.idle()    | ALL   | All return to shadow watch      |

---

## Multi-Agent Workflows

When running parallel agents, route to specific ninjas:

```python
# Agent 1 — file operations
ninja.reading("scanner.py", agent="kage")

# Agent 2 — running tests
ninja.running("pytest -x", agent="ryu")

# Agent 3 — Claude API call
ninja.thinking("Calling Claude for AI analysis...", agent="hana")

# All complete
ninja.done("All agents finished", agent="tora")
```

---

## Full Session Pattern

```python
from driftctl.ninja_bridge import ninja
from driftctl.ninja_bridge import ninja

def run_session():
    # Start
    ninja.thinking("Loading project state...")
    state = load_driftctl_state()

    # File scan
    ninja.reading("scanner.py")
    scanner_code = Path("scanner.py").read_text()

    # Analysis
    ninja.thinking(f"Analyzing {len(scanner_code)} chars...")
    analysis = analyze(scanner_code)

    # Write output
    ninja.writing("options_integration.py")
    Path("options_integration.py").write_text(analysis.code)

    # Run verification
    ninja.running("python spread_builder.py")
    result = subprocess.run(["python", "spread_builder.py"], capture_output=True)

    if result.returncode != 0:
        ninja.error(result.stderr.decode()[:60])
        return

    # Checkpoint via driftctl
    ninja.done("Session complete — checkpoint saved")
    subprocess.run(["driftctl", "checkpoint"])
    ninja.idle()
```

---

## driftctl Command Auto-Hooks

If you add `cli_hooks.py` to driftctl, every CLI command auto-signals
the relevant ninja:

```
driftctl checkpoint  → TORA gold confetti
driftctl drift       → HANA meditates → KEN/TORA on result
driftctl handoff     → TORA gold confetti
driftctl guard       → KEN checks rules
driftctl status      → HANA reads state
```

---

## Debugging

```python
# See where the activity file is:
print(ninja.activity_file)
# → /path/to/project/.driftctl/ninja_activity.ndjson

# Manually tail it:
# tail -f .driftctl/ninja_activity.ndjson

# Trim if it gets large (auto-called on checkpoint):
ninja.trim(max_lines=200)
```

---

## Rules for Claude Code Agents

1. **Call ninja before every significant action**, not after
2. **Never skip ninja.error()** — KEN must fight every battle
3. **Always end with ninja.idle()** when a session completes
4. **Use ninja.thinking() for all waits** > 1 second
5. The bridge is fire-and-forget — it will never throw, never block
