import * as vscode from 'vscode';
import { NinjaPanelProvider, AgentActivity } from './ninjaPanel';
import { startFileWatcher } from './extension_patch';

export function activate(context: vscode.ExtensionContext): void {
  // 1. Register the sidebar webview provider
  const provider = new NinjaPanelProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      NinjaPanelProvider.viewType,
      provider
    )
  );

  // 2. Start the file watcher (bridges ninja_bridge.py → sidebar)
  startFileWatcher(context, provider);

  // 3. Register the demo command
  context.subscriptions.push(
    vscode.commands.registerCommand('ninjaAgents.triggerDemo', () => {
      const demoSequence: AgentActivity[] = [
        { type: 'file_read', agentId: 'kage', detail: 'Scanning: scanner.py',       timestamp: Date.now() },
        { type: 'terminal',  agentId: 'ryu',  detail: '$ npm run build',            timestamp: Date.now() },
        { type: 'thinking',  agentId: 'hana', detail: 'Analyzing 3,847 tokens...',   timestamp: Date.now() },
        { type: 'error',     agentId: 'ken',  detail: '2 type errors in index.ts',   timestamp: Date.now() },
        { type: 'complete',  agentId: 'tora', detail: 'All tests passed!',           timestamp: Date.now() },
        { type: 'idle',      agentId: 'all',  detail: 'Watching shadows...',         timestamp: Date.now() },
      ];

      let i = 0;
      const interval = setInterval(() => {
        if (i >= demoSequence.length) {
          clearInterval(interval);
          return;
        }
        provider.sendActivity(demoSequence[i]);
        i++;
      }, 1500);
    })
  );

  console.log('[NinjaAgents] Extension activated');
}

export function deactivate(): void {}
