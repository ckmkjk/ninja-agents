/**
 * extension_patch.ts
 * 
 * INSTRUCTIONS:
 * Copy the `watchDriftctlBridge()` function below and the
 * `startFileWatcher()` call into your existing extension.ts.
 * 
 * In activate():
 *   1. Add `import * as fs from 'fs';` and `import * as path from 'path';`
 *      at the top of extension.ts
 *   2. Call `startFileWatcher(context, provider)` inside activate()
 *      after registering the webview provider.
 *
 * That's the entire integration — 2 imports + 1 function call.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { NinjaPanelProvider, AgentActivity } from './ninjaPanel';

// ── ACTIVITY FILE RESOLUTION ────────────────────────────────────
// Mirrors Python: walk up from workspace root looking for .driftctl/
function resolveActivityFile(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    // Fallback: home directory
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(home, '.driftctl', 'ninja_activity.ndjson');
  }

  let current = workspaceFolders[0].uri.fsPath;

  // Walk up directory tree
  while (true) {
    const candidate = path.join(current, '.driftctl', 'ninja_activity.ndjson');
    const dir = path.join(current, '.driftctl');
    if (fs.existsSync(dir)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }

  // No .driftctl/ found anywhere — use workspace root
  const wsRoot = workspaceFolders[0].uri.fsPath;
  return path.join(wsRoot, '.driftctl', 'ninja_activity.ndjson');
}

// ── NDJSON TAIL WATCHER ────────────────────────────────────────
export function startFileWatcher(
  context: vscode.ExtensionContext,
  provider: NinjaPanelProvider
): void {
  const activityFilePath = resolveActivityFile();
  if (!activityFilePath) return;

  let lastSeq = -1;
  let lastFileSize = 0;
  let watcher: fs.FSWatcher | null = null;

  // Ensure the .driftctl/ directory exists so we can watch it
  const dir = path.dirname(activityFilePath);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch { return; }
  }

  // Ensure the activity file exists (touch it)
  if (!fs.existsSync(activityFilePath)) {
    try { fs.writeFileSync(activityFilePath, '', 'utf-8'); } catch { return; }
  }

  function tailNewLines() {
    try {
      const stat = fs.statSync(activityFilePath!);
      if (stat.size <= lastFileSize) {
        // File was truncated/rotated — reset cursor
        if (stat.size < lastFileSize) {
          lastFileSize = 0;
          lastSeq = -1;
        }
        return;
      }

      // Read only the new bytes since last read
      const fd = fs.openSync(activityFilePath!, 'r');
      const bytesToRead = stat.size - lastFileSize;
      const buf = Buffer.alloc(bytesToRead);
      fs.readSync(fd, buf, 0, bytesToRead, lastFileSize);
      fs.closeSync(fd);
      lastFileSize = stat.size;

      const newText = buf.toString('utf-8');
      const lines = newText.split('\n').filter(l => l.trim().length > 0);

      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          // Only process records we haven't seen yet
          if (record.seq !== undefined && record.seq <= lastSeq) continue;
          if (record.seq !== undefined) lastSeq = record.seq;

          const activity: AgentActivity = {
            type:      record.type      || 'idle',
            agentId:   record.agentId   || 'all',
            detail:    record.detail    || '',
            timestamp: record.timestamp || Date.now(),
          };

          provider.sendActivity(activity);
        } catch {
          // Malformed line — skip silently
        }
      }
    } catch {
      // File read error — skip this tick
    }
  }

  // Use fs.watch for immediate notification, with a 100ms debounce
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function startWatcher() {
    try {
      watcher = fs.watch(activityFilePath!, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(tailNewLines, 80);
        }
      });
    } catch {
      // fs.watch failed (network drive, etc.) — fall back to polling
      startPolling();
    }
  }

  // Fallback polling (every 500ms) for environments where fs.watch fails
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(tailNewLines, 500);
    context.subscriptions.push({ dispose: () => { if (pollInterval) clearInterval(pollInterval); } });
  }

  startWatcher();

  // Do an initial tail to catch anything written before the watcher started
  tailNewLines();

  // Status bar indicator
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBar.text = '🥷 linked';
  statusBar.tooltip = `Ninja Bridge watching: ${activityFilePath}`;
  statusBar.command = 'ninjaAgents.triggerDemo';
  statusBar.show();

  // Workspace change — re-resolve the activity file if user opens a different project
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (watcher) { watcher.close(); watcher = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      lastFileSize = 0;
      lastSeq = -1;
      startWatcher();
    })
  );

  context.subscriptions.push({
    dispose: () => {
      if (watcher) watcher.close();
      if (pollInterval) clearInterval(pollInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
      statusBar.dispose();
    }
  });

  console.log(`[NinjaAgents] Bridge watching: ${activityFilePath}`);
}
