const { execFile } = require('child_process');
const { powerMonitor, screen } = require('electron');

const POLL_MS = 30 * 1000;
const AWAY_SEC = 5 * 60;
const PS_TIMEOUT_MS = 5000;

// One-shot Windows probe: foreground window's process, rect and title. Spawned per poll instead of kept alive, so the
// pet holds no extra process (and no extra RAM) between samples.
const PS_SCRIPT = `
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public static class FW {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
"@
$h = [FW]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { return }
$sb = New-Object System.Text.StringBuilder 512
[void][FW]::GetWindowText($h, $sb, 512)
$p = 0
[void][FW]::GetWindowThreadProcessId($h, [ref]$p)
$r = New-Object FW+RECT
[void][FW]::GetWindowRect($h, [ref]$r)
$n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName
[Console]::OutputEncoding = [Text.Encoding]::UTF8
"$n|$($r.L)|$($r.T)|$($r.R)|$($r.B)|$($sb.ToString())"
`;
const PS_ENCODED = Buffer.from(PS_SCRIPT, 'utf16le').toString('base64');

// Anything matching this is reported as 'private' with the title dropped, so nothing downstream (memory, gate, a future
// LLM call) ever sees it.
const PRIVATE_RE = /bank|vietcombank|techcombank|vpbank|mbbank|momo|zalopay|paypal|password|bitwarden|1password|keepass|lastpass|incognito|inprivate|private browsing|ẩn danh/i;

const BROWSERS = new Set(['chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'arc']);
const CODING = new Set(['code', 'cursor', 'devenv', 'idea64', 'rider64', 'webstorm64', 'pycharm64', 'clion64', 'sublime_text',
  'notepad++', 'windowsterminal', 'wt', 'powershell', 'pwsh', 'cmd', 'githubdesktop', 'gitkraken', 'postman', 'claude']);
const CHAT = new Set(['discord', 'telegram', 'zalo', 'slack', 'teams', 'ms-teams', 'messenger', 'whatsapp']);
const MUSIC = new Set(['spotify', 'applemusic', 'zingmp3']);
const VIDEO = new Set(['vlc', 'potplayermini64', 'potplayer', 'mpv', 'wmplayer', 'netflix']);
const DOCS = new Set(['winword', 'powerpnt', 'excel', 'acrobat', 'acrord32', 'sumatrapdf', 'obsidian', 'notion', 'onenote']);
const GAMES = new Set(['javaw', 'valorant', 'valorant-win64-shipping', 'leagueclient', 'league of legends', 'genshinimpact',
  'steam', 'steamwebhelper', 'epicgameslauncher']);

function classify(proc, title, fullscreen) {
  const p = proc.toLowerCase();
  const t = title.toLowerCase();
  if (CODING.has(p)) return 'coding';
  if (CHAT.has(p)) return 'chat';
  if (MUSIC.has(p)) return 'music';
  if (VIDEO.has(p)) return 'video';
  if (DOCS.has(p)) return 'docs';
  if (GAMES.has(p)) return 'game';
  if (BROWSERS.has(p)) {
    if (/youtube|netflix|twitch|bilibili|phimmoi|fptplay|vieon/.test(t)) return 'video';
    if (/facebook|tiktok|reddit|instagram|threads|twitter| x$/.test(t)) return 'social';
    if (/github|stack overflow|localhost|127\.0\.0\.1|mdn|docs|api reference/.test(t)) return 'coding';
    return 'browsing';
  }
  return fullscreen ? 'game' : 'other';
}

function isFullscreen(l, t, r, b) {
  const d = screen.getDisplayNearestPoint({ x: Math.round((l + r) / 2), y: Math.round((t + b) / 2) });
  const w = r - l;
  const h = b - t;
  // GetWindowRect may report DIPs or physical pixels depending on the probe's DPI awareness; accept either.
  return [1, d.scaleFactor].some(
    (s) => w >= d.bounds.width * s * 0.98 && h >= d.bounds.height * s * 0.98
  );
}

function probe() {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', PS_ENCODED],
      { windowsHide: true, timeout: PS_TIMEOUT_MS, encoding: 'utf8' },
      (err, stdout) => {
        if (err) return resolve(null);
        const line = stdout.replace(/^﻿/, '').trim();
        const parts = line.split('|');
        if (parts.length < 6) return resolve(null);
        const [proc, l, t, r, b] = parts;
        resolve({ proc, rect: [+l, +t, +r, +b], title: parts.slice(5).join('|') });
      }
    );
  });
}

let timer = null;
let inFlight = false;

async function sample() {
  const idleSec = powerMonitor.getSystemIdleTime();
  const ts = Date.now();
  if (idleSec >= AWAY_SEC) return { app: '', title: '', category: 'away', fullscreen: false, idleSec, ts };

  const w = await probe();
  if (!w || !w.proc) return null;

  const priv = PRIVATE_RE.test(w.proc) || PRIVATE_RE.test(w.title);
  const fullscreen = isFullscreen(...w.rect);
  return {
    app: priv ? '' : w.proc,
    title: priv ? '' : w.title,
    category: priv ? 'private' : classify(w.proc, w.title, fullscreen),
    fullscreen,
    idleSec,
    ts,
  };
}

function start(onSample) {
  if (timer) return;
  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const s = await sample();
      if (s) onSample(s);
    } finally {
      inFlight = false;
    }
  };
  run();
  timer = setInterval(run, POLL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, classify };
