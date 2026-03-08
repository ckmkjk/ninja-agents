# Install Guide — Ninja Bridge (driftctl ↔ Ninja Agents)

## Overview

```
Claude Code agent
       ↓ ninja.reading() / ninja.running() / etc.
ninja_bridge.py (in driftctl package)
       ↓ appends one JSON line
.driftctl/ninja_activity.ndjson   ← shared file IPC
       ↑ fs.watch() tails new lines
extension_patch.ts (in VS Code extension)
       ↓ provider.sendActivity()
Ninja Village Sidebar
```

## Step 1 — Copy ninja_bridge.py into driftctl

```bash
# Find where driftctl is installed
DRIFTCTL_PATH=$(python -c "import driftctl; print(driftctl.__path__[0])")

# Copy the bridge module
cp ninja_bridge.py "$DRIFTCTL_PATH/ninja_bridge.py"

# Verify
python -c "from driftctl.ninja_bridge import ninja; ninja.done('Bridge installed!')"
# → writes one line to .driftctl/ninja_activity.ndjson
```

## Step 2 — Wire cli_hooks into driftctl (optional but recommended)

Edit `$DRIFTCTL_PATH/cli.py`:

```python
# Add at top:
from driftctl.ninja_bridge import ninja

# In your checkpoint command, add after state.save():
ninja.done("Checkpoint saved")
ninja.trim()

# In your drift command:
ninja.thinking("Running drift scan...")
# ... existing logic ...
ninja.error(...)  # or ninja.done(...)
```

Or use the automatic wrapper from `cli_hooks.py` (zero manual edits).

## Step 3 — Add the file watcher to your VS Code extension

In `src/extension.ts`:

```typescript
// Add these imports at the top:
import * as fs from 'fs';
import * as path from 'path';
import { startFileWatcher } from './extension_patch';  // ← copy extension_patch.ts to src/

// Inside activate(), after registering the webview provider:
startFileWatcher(context, provider);
```

Then recompile:
```bash
cd ninja-agents
npm run compile
# Reload the Extension Development Host (Cmd+Shift+P → "Developer: Reload Window")
```

## Step 4 — Add CLAUDE.md to your project root

```bash
cp CLAUDE.md /path/to/your/project/CLAUDE.md
# Or append to existing CLAUDE.md
```

## Step 5 — Test end-to-end

```bash
# Terminal 1: tail the activity file
tail -f .driftctl/ninja_activity.ndjson

# Terminal 2: trigger a test event
python -c "
from driftctl.ninja_bridge import ninja
import time
ninja.reading('scanner.py')
time.sleep(1)
ninja.thinking('Analyzing Tier 1 signals...')
time.sleep(1)
ninja.done('Test complete!')
"
```

You should see:
1. JSON lines appearing in Terminal 1
2. KAGE → HANA → TORA animating in the VS Code sidebar

## File Locations

| File | Where it goes |
|------|--------------|
| `ninja_bridge.py` | `$(driftctl path)/ninja_bridge.py` |
| `cli_hooks.py` | Reference only — paste hooks into `cli.py` |
| `extension_patch.ts` | `ninja-agents/src/extension_patch.ts` |
| `CLAUDE.md` | Your project root |
| `ninja_activity.ndjson` | Auto-created at `.driftctl/ninja_activity.ndjson` |

## Troubleshooting

**Ninjas not animating?**
```bash
# Check the activity file exists and is being written to
cat .driftctl/ninja_activity.ndjson

# Check VS Code output panel
# View → Output → select "Ninja Agents" from dropdown
# Should show: "[NinjaAgents] Bridge watching: /path/to/.driftctl/ninja_activity.ndjson"
```

**Activity file in wrong location?**
```bash
python -c "from driftctl.ninja_bridge import ninja; print(ninja.activity_file)"
```

**File watcher not firing (network drive / WSL)?**
The watcher automatically falls back to 500ms polling. No action needed.
