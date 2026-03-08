import * as vscode from 'vscode';

export interface AgentActivity {
  type: string;
  agentId: string;
  detail: string;
  timestamp: number;
}

export class NinjaPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ninjaAgents.ninjaPanel';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    webviewView.onDidDispose(() => {
      this._view = undefined;
    });
  }

  public sendActivity(activity: AgentActivity): void {
    if (!this._view) { return; }
    this._view.webview.postMessage({ command: 'activity', data: activity });
    this._view.show?.(true);
  }

  private _getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: var(--vscode-sideBar-background, #1e1e1e);
      color: var(--vscode-foreground, #ccc);
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: 12px;
      overflow: hidden;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .title-bar {
      text-align: center;
      padding: 8px 4px 4px;
      font-size: 10px;
      letter-spacing: 3px;
      text-transform: uppercase;
      opacity: 0.5;
    }

    /* ── NINJA GRID ─────────────────────────── */
    .village {
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-around;
      align-items: flex-end;
      padding: 8px 4px;
      flex: 1;
      min-height: 0;
    }

    .ninja {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 56px;
      position: relative;
      transition: opacity 0.4s, transform 0.4s;
      opacity: 0.35;
      transform: scale(0.9);
      cursor: default;
    }

    .ninja.active {
      opacity: 1;
      transform: scale(1);
    }

    .sprite {
      font-size: 28px;
      line-height: 1;
      transition: transform 0.3s, text-shadow 0.3s;
      position: relative;
      z-index: 2;
    }

    .ninja-name {
      font-size: 8px;
      letter-spacing: 2px;
      margin-top: 4px;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .glow {
      position: absolute;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      top: -4px;
      left: 50%;
      transform: translateX(-50%);
      opacity: 0;
      filter: blur(12px);
      transition: opacity 0.4s;
      z-index: 1;
      pointer-events: none;
    }

    .ninja.active .glow { opacity: 0.6; }

    /* ── PER-NINJA COLORS ──────────────────── */
    #ninja-kage .glow { background: #FFD700; }
    #ninja-ryu  .glow { background: #00BFFF; }
    #ninja-hana .glow { background: #DA70D6; }
    #ninja-ken  .glow { background: #FF4444; }
    #ninja-tora .glow { background: #FFA500; }

    #ninja-kage.active .sprite { text-shadow: 0 0 12px #FFD700; }
    #ninja-ryu.active  .sprite { text-shadow: 0 0 12px #00BFFF; }
    #ninja-hana.active .sprite { text-shadow: 0 0 12px #DA70D6; }
    #ninja-ken.active  .sprite { text-shadow: 0 0 12px #FF4444; }
    #ninja-tora.active .sprite { text-shadow: 0 0 12px #FFA500; }

    /* ── ANIMATIONS ────────────────────────── */

    /* KAGE — arms extend, kanji float */
    @keyframes kage-activate {
      0%   { transform: scaleX(1); }
      30%  { transform: scaleX(1.3) scaleY(0.95); }
      60%  { transform: scaleX(1.15) scaleY(1.02); }
      100% { transform: scaleX(1); }
    }
    #ninja-kage.active .sprite {
      animation: kage-activate 1.2s ease-out;
    }

    /* RYU — sprint right, shuriken throw */
    @keyframes ryu-sprint {
      0%   { transform: translateX(0) rotate(0); }
      25%  { transform: translateX(10px) rotate(-5deg); }
      50%  { transform: translateX(-3px) rotate(3deg); }
      75%  { transform: translateX(5px) rotate(-2deg); }
      100% { transform: translateX(0) rotate(0); }
    }
    #ninja-ryu.active .sprite {
      animation: ryu-sprint 0.8s ease-in-out;
    }

    /* HANA — levitate + pulse */
    @keyframes hana-levitate {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-8px); }
    }
    @keyframes hana-orbs {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    #ninja-hana.active .sprite {
      animation: hana-levitate 2s ease-in-out infinite;
    }

    /* KEN — combat stance, shake */
    @keyframes ken-combat {
      0%   { transform: scale(1) rotate(0); }
      15%  { transform: scale(1.2) rotate(-8deg); }
      30%  { transform: scale(1.15) rotate(5deg); }
      45%  { transform: scale(1.1) rotate(-3deg); }
      60%  { transform: scale(1.05) rotate(2deg); }
      100% { transform: scale(1) rotate(0); }
    }
    #ninja-ken.active .sprite {
      animation: ken-combat 0.7s ease-out;
    }
    #ninja-ken.active .glow { opacity: 0.9; }

    /* TORA — celebrate bounce */
    @keyframes tora-celebrate {
      0%   { transform: scale(1) translateY(0); }
      20%  { transform: scale(1.25) translateY(-10px); }
      40%  { transform: scale(1.1) translateY(-4px); }
      60%  { transform: scale(1.2) translateY(-8px); }
      80%  { transform: scale(1.05) translateY(-2px); }
      100% { transform: scale(1) translateY(0); }
    }
    #ninja-tora.active .sprite {
      animation: tora-celebrate 1.2s ease-out;
    }

    /* ── IDLE BREATHING ────────────────────── */
    @keyframes idle-breathe {
      0%, 100% { transform: scale(0.9); }
      50%      { transform: scale(0.93); }
    }
    .ninja:not(.active) .sprite {
      animation: idle-breathe 3s ease-in-out infinite;
    }

    /* ── PARTICLES ─────────────────────────── */
    .particle {
      position: absolute;
      pointer-events: none;
      border-radius: 50%;
      z-index: 10;
      animation: particle-rise 1s ease-out forwards;
    }

    @keyframes particle-rise {
      0%   { opacity: 1; transform: translate(0, 0) scale(1); }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
    }

    /* Confetti for TORA */
    .confetti {
      position: absolute;
      width: 4px;
      height: 4px;
      pointer-events: none;
      z-index: 10;
      animation: confetti-fall 1.5s ease-out forwards;
    }

    @keyframes confetti-fall {
      0%   { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      100% { opacity: 0; transform: translate(var(--dx), 40px) rotate(var(--rot)); }
    }

    /* Shuriken for RYU */
    .shuriken {
      position: absolute;
      pointer-events: none;
      z-index: 10;
      font-size: 10px;
      animation: shuriken-fly 0.6s ease-out forwards;
    }

    @keyframes shuriken-fly {
      0%   { opacity: 1; transform: translate(0, 0) rotate(0deg); }
      100% { opacity: 0; transform: translate(50px, -15px) rotate(720deg); }
    }

    /* Orbs for HANA */
    .orb-ring {
      position: absolute;
      width: 44px;
      height: 44px;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 3;
      animation: hana-orbs 2s linear infinite;
    }

    .orb {
      position: absolute;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #DA70D6;
      box-shadow: 0 0 6px #DA70D6;
    }

    .orb:nth-child(1) { top: 0; left: 50%; transform: translateX(-50%); }
    .orb:nth-child(2) { bottom: 0; left: 50%; transform: translateX(-50%); }
    .orb:nth-child(3) { top: 50%; left: 0; transform: translateY(-50%); }
    .orb:nth-child(4) { top: 50%; right: 0; transform: translateY(-50%); }

    /* ── DETAIL BAR ────────────────────────── */
    .detail-bar {
      padding: 6px 10px;
      min-height: 32px;
      border-top: 1px solid var(--vscode-panel-border, #333);
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      opacity: 0.8;
      transition: opacity 0.3s;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .detail-bar.has-text { opacity: 1; }

    /* ── STATUS DOT ────────────────────────── */
    .status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      gap: 6px;
      font-size: 9px;
      opacity: 0.4;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #555;
      transition: background 0.3s;
    }

    .status-dot.connected { background: #4ec9b0; }
  </style>
</head>
<body>
  <div class="title-bar">NINJA VILLAGE</div>

  <div class="village">
    <div class="ninja" id="ninja-kage" data-agent="kage">
      <div class="glow"></div>
      <div class="sprite">\u5F71</div>
      <div class="ninja-name">KAGE</div>
    </div>
    <div class="ninja" id="ninja-ryu" data-agent="ryu">
      <div class="glow"></div>
      <div class="sprite">\u9F8D</div>
      <div class="ninja-name">RYU</div>
    </div>
    <div class="ninja" id="ninja-hana" data-agent="hana">
      <div class="glow"></div>
      <div class="sprite">\u82B1</div>
      <div class="ninja-name">HANA</div>
    </div>
    <div class="ninja" id="ninja-ken" data-agent="ken">
      <div class="glow"></div>
      <div class="sprite">\u5263</div>
      <div class="ninja-name">KEN</div>
    </div>
    <div class="ninja" id="ninja-tora" data-agent="tora">
      <div class="glow"></div>
      <div class="sprite">\u864E</div>
      <div class="ninja-name">TORA</div>
    </div>
  </div>

  <div class="detail-bar" id="detail-bar"></div>

  <div class="status-row">
    <div class="status-dot" id="status-dot"></div>
    <span id="status-text">waiting</span>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      const ninjas = document.querySelectorAll('.ninja');
      const detailBar = document.getElementById('detail-bar');
      const statusDot = document.getElementById('status-dot');
      const statusText = document.getElementById('status-text');
      let clearTimers = {};
      let orbRing = null;

      function setConnected() {
        statusDot.classList.add('connected');
        statusText.textContent = 'linked';
      }

      function clearAll() {
        ninjas.forEach(n => n.classList.remove('active'));
        if (orbRing) { orbRing.remove(); orbRing = null; }
        Object.values(clearTimers).forEach(t => clearTimeout(t));
        clearTimers = {};
      }

      function spawnParticles(el, type) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 3;
        const colors = {
          file_read: '#FFD700', file_write: '#FFD700',
          terminal: '#00BFFF', thinking: '#DA70D6',
          error: '#FF4444', complete: '#FFA500',
        };
        const color = colors[type] || '#ccc';

        if (type === 'complete') {
          // Gold confetti burst
          for (let i = 0; i < 12; i++) {
            const c = document.createElement('div');
            c.className = 'confetti';
            const dx = (Math.random() - 0.5) * 60;
            const rot = (Math.random() - 0.5) * 720;
            c.style.cssText =
              'left:' + cx + 'px;top:' + cy + 'px;' +
              'background:' + ['#FFD700','#FFA500','#FF6347','#4ec9b0'][i%4] + ';' +
              '--dx:' + dx + 'px;--rot:' + rot + 'deg;' +
              'animation-delay:' + (i * 0.05) + 's;';
            document.body.appendChild(c);
            c.addEventListener('animationend', () => c.remove());
          }
          return;
        }

        if (type === 'terminal') {
          // Shuriken throw
          const s = document.createElement('div');
          s.className = 'shuriken';
          s.textContent = '\u2726';
          s.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;color:#00BFFF;';
          document.body.appendChild(s);
          s.addEventListener('animationend', () => s.remove());
          return;
        }

        if (type === 'thinking') {
          // Orbiting dots — attach to the ninja element
          if (orbRing) { orbRing.remove(); }
          orbRing = document.createElement('div');
          orbRing.className = 'orb-ring';
          for (let i = 0; i < 4; i++) {
            const o = document.createElement('div');
            o.className = 'orb';
            orbRing.appendChild(o);
          }
          el.appendChild(orbRing);
          return;
        }

        // Default: rising particles
        const count = type === 'error' ? 8 : 5;
        for (let i = 0; i < count; i++) {
          const p = document.createElement('div');
          p.className = 'particle';
          const dx = (Math.random() - 0.5) * 30;
          const dy = -(20 + Math.random() * 25);
          const size = 3 + Math.random() * 4;
          p.style.cssText =
            'left:' + cx + 'px;top:' + cy + 'px;' +
            'width:' + size + 'px;height:' + size + 'px;' +
            'background:' + color + ';box-shadow:0 0 4px ' + color + ';' +
            '--dx:' + dx + 'px;--dy:' + dy + 'px;' +
            'animation-delay:' + (i * 0.08) + 's;';
          document.body.appendChild(p);
          p.addEventListener('animationend', () => p.remove());
        }
      }

      function handleActivity(activity) {
        setConnected();

        if (activity.type === 'idle') {
          clearAll();
          detailBar.textContent = '';
          detailBar.classList.remove('has-text');
          return;
        }

        // Find target ninja
        const id = activity.agentId ? activity.agentId.toLowerCase() : 'all';
        const el = document.getElementById('ninja-' + id);
        if (!el) return;

        // Clear previous state for this ninja
        if (clearTimers[id]) { clearTimeout(clearTimers[id]); }

        // Deactivate others (only one ninja active at a time for clarity)
        ninjas.forEach(n => { if (n !== el) n.classList.remove('active'); });
        if (orbRing && !el.contains(orbRing)) { orbRing.remove(); orbRing = null; }

        // Activate
        el.classList.remove('active');
        // Force reflow to restart animation
        void el.offsetWidth;
        el.classList.add('active');

        // Particles
        spawnParticles(el, activity.type);

        // Detail text
        detailBar.textContent = activity.detail || '';
        detailBar.classList.toggle('has-text', !!activity.detail);

        // Auto-clear (except thinking which loops)
        if (activity.type !== 'thinking') {
          clearTimers[id] = setTimeout(() => {
            el.classList.remove('active');
          }, 3000);
        }
      }

      window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.command === 'activity') {
          handleActivity(msg.data);
        }
      });
    })();
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
