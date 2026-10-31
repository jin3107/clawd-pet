const { app, BrowserWindow, screen, Tray, Menu, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('path');
const {
  DEFAULT_GREETINGS, loadConfig, saveConfig, greetingsFor, storeBrainKey, brainKeyFor, migrateLegacyConfig,
} = require('./config');
const awareness = require('./awareness');
const brain = require('./brain');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

migrateLegacyConfig(path.join(app.getPath('appData'), 'clawd-pet'), app.getPath('userData'));

app.disableHardwareAcceleration();
// Memory: fold the GPU process into main, share one renderer between windows, and cap V8's heap (the pet is tiny).
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=48');

const PET_W = 100;
const PET_H = 68;
// Transparent rows under each sprite's feet inside the 68px window; the pad pushes the window below the work area
// so the feet land on the taskbar edge (measured per model: clawd ~5px, cat ~18px, sheep ~18px).
const GROUND_PAD_BY_MODEL = { clawd: 4, cat: 17, sheep: 18 };
const WALK_SPEED = 1.6;
const SURF_SPEED = 4.5;
const CLIMB_SPEED = 1.2;
const CLIMB_H = 90;
const AFK_MS = 12000;

let petConfig = null;
let CARE_MESSAGES = [];
let CARE_MIN_MS = 60 * 60 * 1000;
let CARE_MAX_MS = 75 * 60 * 1000;
const LOGIN_START_DELAY_MS = 45 * 1000;
const SETTINGS_W = 560;
const SETTINGS_H = 620;
const MODEL_PICKER_W = 500;
const MODEL_PICKER_H = 490;
const BUBBLE_W = 220;
const HEAD_ANCHOR_Y = 18;

const FAST_MS = 30;
const SLOW_MS = 150;
const STATIONARY = new Set(['idle', 'jump', 'code', 'music', 'soccer', 'pat', 'think', 'coffee', 'butterfly']);

let win;
let bubbleWin;
let tray;
let careBubbleActive = false;
let currentX = 0;
let currentY = 0;
let targetX = 0;
let facing = 1;
let state = 'idle';
let frames = 60;
let climbPhase = 'up';
let codePhase = 'prep';
let coffeePhase = 'lift';
let fallChute = false;
let fallScared = false;
let lastX = -1;
let lastY = -1;
let lastSentState = null;
let lastSentFacing = null;
let lastSentCareMsg = null;
let scheduledDelay = FAST_MS;

let dragging = false;
let dragOffX = 0;
let dragOffY = 0;
let vy = 0;
let patting = false;
let lastCursor = { x: 0, y: 0 };
let lastCursorMove = Date.now();
let tickN = 0;
let fleeing = false;
let activity = 'other'; // latest category from the awareness observer

const MIRROR_TRICK = { coding: 'code', music: 'music' };
const MIRROR_CHANCE = 0.7;
// States that are safe to cut short; think (bubble), fall, climb, held and pat are left to finish.
const REACT_INTERRUPTIBLE = new Set(['idle', 'walk', 'jump', 'soccer', 'surf', 'music', 'code', 'coffee']);

// Seated coding, frame-accurate to the real sprite (see states.css): hard-cut poses in this order. A stationary tick is
// 150ms and burns 5 frames, so frames = 5 per tick.
const CODE_NEXT = {
  prep: 'raise', raise: 'hold', hold: 'swing', swing: 'land', land: 'ears', ears: 'sit', sit: 'typing',
  typing: 'up', up: 'carry', carry: 'away', away: 'relax',
};
const CODE_PHASE_FRAMES = {
  prep: 15, raise: 5, hold: 10, swing: 5, land: 5, ears: 5, sit: 5, up: 5, carry: 5, away: 10, relax: 5,
};
const codePhaseFrames = (phase) => (phase === 'typing' ? 250 + Math.random() * 250 : CODE_PHASE_FRAMES[phase]);

const DODGE_MARGIN = 8;
const DODGE_DIST = 260;
const DODGEABLE = new Set(['idle', 'code', 'jump', 'music', 'soccer', 'think', 'coffee', 'walk', 'butterfly']);

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

// Matches --bg in ui.css so the settings/picker windows do not flash white before the page paints in dark mode.
function uiBackground() {
  return nativeTheme.shouldUseDarkColors ? '#202020' : '#F3F3F3';
}

function baseY() {
  const wa = workArea();
  const model = petConfig?.petModel || 'clawd';
  return wa.y + wa.height - PET_H + (GROUND_PAD_BY_MODEL[model] ?? GROUND_PAD_BY_MODEL.clawd);
}

function clampX(x) {
  const wa = workArea();
  return Math.min(Math.max(x, wa.x), wa.x + wa.width - PET_W);
}

function createWindow() {
  const wa = workArea();
  currentX = wa.x + wa.width / 2 - PET_W / 2;
  currentY = baseY();

  win = new BrowserWindow({
    width: PET_W,
    height: PET_H,
    x: Math.round(currentX),
    y: Math.round(currentY),
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  startIdle();
  scheduledDelay = FAST_MS;
  setTimeout(tick, scheduledDelay);
}

// The bubble window is created per care message and destroyed on hide: it only shows about once an hour, so keeping
// its renderer alive would cost memory for nothing.
function createBubbleWindow(text) {
  bubbleWin = new BrowserWindow({
    width: BUBBLE_W,
    height: 10,
    x: 0,
    y: 0,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'bubblePreload.js'),
      contextIsolation: true,
    },
  });
  bubbleWin.setAlwaysOnTop(true, 'screen-saver');
  bubbleWin.setIgnoreMouseEvents(true, { forward: true });
  bubbleWin.webContents.once('did-finish-load', () => {
    if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.webContents.send('bubble-text', text);
  });
  bubbleWin.loadFile(path.join(__dirname, 'renderer', 'bubble.html'));
}

function hideBubble() {
  if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.destroy();
  bubbleWin = null;
}

function pickTarget(minDist) {
  const wa = workArea();
  const minX = wa.x;
  const maxX = wa.x + wa.width - PET_W;
  let t;
  let tries = 0;
  do {
    t = minX + Math.random() * Math.max(0, maxX - minX);
  } while (Math.abs(t - currentX) < minDist && ++tries < 20);
  return t;
}

function startIdle() {
  state = 'idle';
  frames = 60 + Math.random() * 180;
  fleeing = false;
}

// Only Clawd has the code/music tricks (cat and sheep skip them), so the others never mirror.
function mirrorTrick() {
  if (petConfig?.petModel !== 'clawd') return null;
  return MIRROR_TRICK[activity] || null;
}

// When the user's activity changes, switch right away instead of waiting for the next idle roll.
function reactToActivity() {
  const mirror = mirrorTrick();
  if (!mirror || state === mirror || dragging || patting || !REACT_INTERRUPTIBLE.has(state)) return;
  fleeing = false;
  startTrick(mirror);
}

// Dev menu helper: play a trick on demand instead of waiting for the random pick.
function devPlayTrick(trick) {
  if (dragging || patting) return;
  fleeing = false;
  startTrick(trick);
}

function nextAction() {
  // User is away from the machine: stay put instead of wandering (also saves the 30ms tick work).
  if (activity === 'away') {
    startIdle();
    frames = 300;
    return;
  }

  // Mini brain: apply the answer that arrived since the last decision point, then ask for the next one. While the brain
  // is cooling down, waiting on the API, backing off after an error or off, nothing is taken and the state machine below
  // runs as usual. This sits before the AFK branch because a typing user rarely moves the mouse, so AFK is the common case.
  const thought = brain.take();
  brain.request({
    petName: petConfig?.petName || 'Pixel Pet',
    model: petConfig?.petModel || 'clawd',
    hour: new Date().getHours(),
    activity,
    state,
  });
  if (thought && applyBrainDecision(thought)) return;

  const afk = Date.now() - lastCursorMove > AFK_MS;
  if (afk) {
    if (Math.random() < 0.25) {
      state = 'jump';
      frames = 40;
    } else {
      state = 'walk';
      targetX = clampX(lastCursor.x - PET_W / 2 + (Math.random() * 160 - 80));
    }
    return;
  }

  // Mirror what the user is doing most of the time, but keep some wandering so it does not look frozen.
  const mirror = mirrorTrick();
  if (mirror && Math.random() < MIRROR_CHANCE) {
    startTrick(mirror);
    return;
  }

  if (Math.random() < 0.45) {
    state = 'walk';
    targetX = pickTarget(40);
    return;
  }

  // Cat/sheep skip coffee/music/code/surf/soccer tricks per user request; keep the full set for Clawd.
  // "butterfly" (pounce-at-a-butterfly) is cat-only — the prop only exists in the cat template.
  const tricks = petConfig?.petModel === 'clawd'
    ? ['code', 'jump', 'music', 'soccer', 'climb', 'surf', 'think', 'coffee']
    : petConfig?.petModel === 'cat'
      ? ['jump', 'climb', 'think', 'butterfly']
      : ['jump', 'climb', 'think'];
  startTrick(tricks[Math.floor(Math.random() * tricks.length)]);
}

// Returns false when the decision cannot be applied (the caller then falls back to the state machine).
function applyBrainDecision({ state: next, say }) {
  console.log(`[brain] apply state=${next} say=${say ? JSON.stringify(say) : 'none'}`);
  if (say && showCareMessage(say)) return true;
  if (!brain.allowedStates(petConfig?.petModel || 'clawd').includes(next)) return false;
  fleeing = false;
  if (next === 'idle') {
    startIdle();
  } else if (next === 'walk') {
    state = 'walk';
    targetX = pickTarget(40);
  } else {
    startTrick(next);
  }
  return true;
}

function startTrick(trick) {
  switch (trick) {
    case 'code':
      state = 'code';
      codePhase = 'prep';
      frames = codePhaseFrames('prep');
      break;
    case 'coffee':
      state = 'coffee';
      coffeePhase = 'lift';
      frames = 15;
      break;
    case 'think':
      state = 'think';
      frames = 180 + Math.random() * 200;
      break;
    case 'jump':
      state = 'jump';
      frames = 45;
      break;
    case 'music':
      state = 'music';
      frames = 300 + Math.random() * 200;
      break;
    case 'soccer':
      state = 'soccer';
      frames = 260 + Math.random() * 150;
      break;
    case 'climb':
      state = 'climb';
      climbPhase = 'up';
      break;
    case 'butterfly':
      state = 'butterfly';
      frames = 200 + Math.random() * 150;
      break;
    case 'surf':
      state = 'surf';
      targetX = pickTarget(300);
      break;
  }
}

function tick() {
  tickN++;
  const cur = screen.getCursorScreenPoint();
  if (Math.abs(cur.x - lastCursor.x) > 2 || Math.abs(cur.y - lastCursor.y) > 2) {
    lastCursor = { x: cur.x, y: cur.y };
    lastCursorMove = Date.now();
  }

  const by = baseY();

  if (!dragging && !patting && !fleeing && DODGEABLE.has(state) &&
      cur.x > currentX - DODGE_MARGIN && cur.x < currentX + PET_W + DODGE_MARGIN &&
      cur.y > currentY - DODGE_MARGIN && cur.y < currentY + PET_H + DODGE_MARGIN) {
    const away = cur.x < currentX + PET_W / 2 ? 1 : -1;
    targetX = clampX(currentX + away * DODGE_DIST);
    state = 'walk';
    fleeing = true;
  }

  if (dragging) {
    state = 'held';
    currentX = cur.x - dragOffX;
    currentY = cur.y - dragOffY;
  } else if (state === 'fall') {
    if (fallChute) {
      vy += 0.15;
      if (vy > 1.6) vy = 1.6;
    } else {
      vy += 0.9;
    }
    currentY += vy;
    currentX = clampX(currentX);
    if (currentY >= by) {
      currentY = by;
      if (vy > 5) vy = -vy * 0.35;
      else startIdle();
    }
  } else if (patting && ['idle', 'walk', 'code', 'jump', 'music', 'soccer', 'pat'].includes(state)) {
    state = 'pat';
    currentY = by;
  } else if (state === 'pat') {
    startIdle();
  } else if (state === 'walk' || state === 'surf') {
    const dx = targetX - currentX;
    if (state === 'walk') {
      if (Math.abs(dx) < 4) {
        startIdle();
      } else if (tickN % 2 === 0) {
        facing = dx > 0 ? 1 : -1;
        currentX += facing * 3.2;
      }
    } else {
      if (Math.abs(dx) < SURF_SPEED + 1) {
        startIdle();
      } else {
        facing = dx > 0 ? 1 : -1;
        currentX += facing * SURF_SPEED;
      }
    }
    currentY = by;
  } else if (state === 'climb') {
    const topY = by - CLIMB_H;
    if (climbPhase === 'up') {
      currentY -= CLIMB_SPEED;
      if (currentY <= topY) {
        currentY = topY;
        climbPhase = 'pause';
        frames = 80 + Math.random() * 120;
      }
    } else if (climbPhase === 'pause') {
      if (--frames <= 0) climbPhase = 'down';
    } else {
      currentY += CLIMB_SPEED * 1.6;
      if (currentY >= by) {
        currentY = by;
        startIdle();
      }
    }
  } else {
    currentY = by;
    frames -= scheduledDelay / FAST_MS;
    if (frames <= 0) {
      if (state === 'idle') nextAction();
      else if (state === 'code' && CODE_NEXT[codePhase]) {
        codePhase = CODE_NEXT[codePhase];
        frames = codePhaseFrames(codePhase);
      } else if (state === 'coffee' && coffeePhase === 'lift') {
        coffeePhase = 'sip';
        frames = 200 + Math.random() * 150;
      } else startIdle();
    }
  }

  if (careBubbleActive && state !== 'think') {
    careBubbleActive = false;
    hideBubble();
  }

  if (!win || win.isDestroyed()) return;

  const nx = Math.round(currentX);
  const ny = Math.round(currentY);
  if (nx !== lastX || ny !== lastY) {
    win.setBounds({ x: nx, y: ny, width: PET_W, height: PET_H });
    lastX = nx;
    lastY = ny;
  }

  const sentState =
    state === 'climb' ? `climb-${climbPhase}` :
    state === 'code' ? `code-${codePhase}` :
    state === 'coffee' ? `coffee-${coffeePhase}` :
    state === 'fall' ? `fall${fallChute ? '-chute' : ''}${fallScared ? '-scared' : ''}` :
    state;
  if (sentState !== lastSentState || facing !== lastSentFacing || careBubbleActive !== lastSentCareMsg) {
    // The frame can be mid-reload (model switch) or gone (quit); skip and retry on the next tick instead of throwing.
    try {
      win.webContents.send('pet-state', { state: sentState, facing, careMsg: careBubbleActive });
      lastSentState = sentState;
      lastSentFacing = facing;
      lastSentCareMsg = careBubbleActive;
    } catch {}
  }

  const nextDelay = !dragging && STATIONARY.has(state) ? SLOW_MS : FAST_MS;
  scheduledDelay = nextDelay;
  setTimeout(tick, nextDelay);
}

ipcMain.on('pet-interactive', (_e, on) => {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!on, { forward: true });
});

ipcMain.on('pet-drag-start', (_e, { x, y }) => {
  dragging = true;
  patting = false;
  dragOffX = x;
  dragOffY = y;
  if (careBubbleActive) {
    careBubbleActive = false;
    hideBubble();
  }
});

ipcMain.on('bubble-size', (_e, { w, h }) => {
  if (!bubbleWin || bubbleWin.isDestroyed() || !careBubbleActive) return;
  const wa = workArea();
  const bx = Math.min(Math.max(Math.round(currentX + PET_W / 2 - w / 2), wa.x), wa.x + wa.width - w);
  const by = Math.round(currentY + HEAD_ANCHOR_Y - h);
  bubbleWin.setBounds({ x: bx, y: by, width: w, height: h });
  bubbleWin.showInactive();
});

ipcMain.on('pet-drag-end', () => {
  if (!dragging) return;
  dragging = false;
  vy = 0;
  state = 'fall';
  fallChute = Math.random() < 0.35;
  fallScared = Math.random() < 0.5;
});

ipcMain.on('pet-pat', (_e, on) => {
  if (!dragging) patting = on;
  if (!on) patting = false;
});

function scheduleCareMessage() {
  const delay = CARE_MIN_MS + Math.random() * (CARE_MAX_MS - CARE_MIN_MS);
  setTimeout(() => {
    // With awareness on, the gate decides when to speak; the blind timer would just be noise on top.
    if (!awareness.isRunning()) showCareMessage();
    scheduleCareMessage();
  }, delay);
}

// Returns true if the bubble was shown (the pet may be busy falling/climbing/being dragged).
function showCareMessage(text) {
  if (!win || win.isDestroyed() || dragging || state === 'fall' || state === 'climb') return false;
  const msg = text || CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)];
  state = 'think';
  frames = Math.max(200, Math.min(360, msg.length * 9));
  careBubbleActive = true;
  hideBubble();
  createBubbleWindow(msg);
  return true;
}

function setAwareness(on) {
  if (on) {
    awareness.start({
      onActivity: (category) => {
        const changed = category !== activity;
        activity = category;
        if (changed) reactToActivity();
      },
      onSay: (text) => showCareMessage(text),
    });
  } else {
    awareness.stop();
    activity = 'other';
  }
}

function hasBrainKey() {
  return brain.isConfigured();
}

function buildTrayMenu() {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  // Without a key the toggle would do nothing, so it opens the settings window where the key is entered.
  const brainItem = hasBrainKey()
    ? {
        label: 'Mini brain (LLM)',
        type: 'checkbox',
        checked: !!petConfig?.brain,
        click: (item) => {
          petConfig = { ...(petConfig || loadConfig()), brain: item.checked };
          saveConfig(petConfig);
          applyBrain(petConfig);
          buildTrayMenu();
        },
      }
    : { label: 'Mini brain (LLM): chưa thiết lập...', click: () => createSettingsWindow(false) };

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Cài đặt...', click: () => createSettingsWindow(false) },
      { label: 'Đổi pet...', click: () => createModelPickerWindow(false, true) },
      { type: 'separator' },
      {
        label: 'Pet quan sát app đang dùng',
        type: 'checkbox',
        checked: !!petConfig?.awareness,
        click: (item) => {
          petConfig = { ...(petConfig || loadConfig()), awareness: item.checked };
          saveConfig(petConfig);
          setAwareness(item.checked);
          buildTrayMenu();
        },
      },
      brainItem,
      {
        label: 'Chạy cùng Windows',
        type: 'checkbox',
        checked: openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
          buildTrayMenu();
        },
      },
      ...(app.isPackaged ? [] : [
        { type: 'separator' },
        {
          label: '[dev] Thử nghiệm',
          submenu: [
            { label: 'Nói ngay', click: () => showCareMessage(awareness.previewLine()) },
            { label: 'Replay: gõ code', click: () => devPlayTrick('code') },
            { label: 'Replay: nghe nhạc', click: () => devPlayTrick('music') },
            { label: 'Replay: lướt ván', click: () => devPlayTrick('surf') },
            { label: 'Replay: uống cà phê', click: () => devPlayTrick('coffee') },
            { label: 'Replay: đá bóng', click: () => devPlayTrick('soccer') },
          ],
        },
      ]),
      { type: 'separator' },
      { label: `Version ${app.getVersion()}`, enabled: false },
      { label: 'Exit', click: () => app.quit() },
    ])
  );
}

function applyBrain(config) {
  brain.configure({
    enabled: !!config.brain,
    apiKey: brainKeyFor(config),
    model: config.brainModel || brain.DEFAULT_MODEL,
    endpoint: config.brainEndpoint || brain.DEFAULT_ENDPOINT,
    reasoningEffort: config.brainReasoningEffort || '',
  });
}

function applyConfig(config) {
  petConfig = config;
  applyBrain(config);
  CARE_MESSAGES = greetingsFor(config);
  CARE_MIN_MS = config.intervalMinMin * 60 * 1000;
  CARE_MAX_MS = config.intervalMaxMin * 60 * 1000;
  if (tray && !tray.isDestroyed()) tray.setToolTip(config.petName);
}

ipcMain.handle('pet-get-model', () => (petConfig?.petModel || loadConfig().petModel || 'clawd'));

let modelPickerWin = null;

function createModelPickerWindow(isFirstRun, switching = false) {
  if (modelPickerWin && !modelPickerWin.isDestroyed()) {
    modelPickerWin.focus();
    return;
  }

  const wa = workArea();
  let picked = false;

  modelPickerWin = new BrowserWindow({
    width: MODEL_PICKER_W,
    height: MODEL_PICKER_H,
    x: Math.round(wa.x + wa.width / 2 - MODEL_PICKER_W / 2),
    y: Math.round(wa.y + wa.height / 2 - MODEL_PICKER_H / 2),
    resizable: false,
    backgroundColor: uiBackground(),
    icon: path.join(__dirname, 'renderer', 'app-icon.png'),
    title: 'Pixel Pet - Chọn pet',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'modelPickerPreload.js'),
      contextIsolation: true,
    },
  });
  modelPickerWin.loadFile(path.join(__dirname, 'renderer', 'model-picker.html'));

  const onPick = (_e, model) => {
    picked = true;
    const config = { ...loadConfig(), petModel: model };
    saveConfig(config);
    petConfig = config;
    modelPickerWin.close();
    if (switching) {
      // pet.js reads the model once at load, so reload the sprite window and force the state to be re-sent.
      lastSentState = null;
      if (win && !win.isDestroyed()) win.webContents.reload();
      return;
    }
    createSettingsWindow(isFirstRun);
  };
  ipcMain.once('model-pick', onPick);

  modelPickerWin.on('closed', () => {
    ipcMain.removeListener('model-pick', onPick);
    modelPickerWin = null;
    if (switching) return;
    if (!picked) {
      // User closed the picker without choosing — keep the default model
      // (loadConfig()'s fallback) and continue into settings as normal.
      const config = { ...loadConfig(), petModel: loadConfig().petModel || 'clawd' };
      saveConfig(config);
      petConfig = config;
      createSettingsWindow(isFirstRun);
    }
  });
}

let settingsWin = null;
let settingsFirstRun = false;

function sameHost(a, b) {
  try {
    return new URL(a).host === new URL(b).host;
  } catch {
    return false;
  }
}

// The renderer sends the key as plain form data; it is encrypted here and never written to the config as text. A stored
// key belongs to one provider, so moving to another host without typing a new key drops it instead of sending it there.
function splitBrainKey(data) {
  const { brainApiKey, clearBrainKey, ...rest } = data;
  const cur = loadConfig();
  if (brainApiKey) {
    rest.brainKeyEnc = storeBrainKey(brainApiKey);
    rest.xaiApiKey = '';
  } else if (clearBrainKey || (rest.brainEndpoint && !sameHost(rest.brainEndpoint, cur.brainEndpoint))) {
    rest.brainKeyEnc = '';
    rest.xaiApiKey = '';
  }
  return rest;
}

function createSettingsWindow(isFirstRun) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  settingsFirstRun = isFirstRun;
  const wa = workArea();
  let saved = false;

  settingsWin = new BrowserWindow({
    width: SETTINGS_W,
    height: SETTINGS_H,
    x: Math.round(wa.x + wa.width / 2 - SETTINGS_W / 2),
    y: Math.round(wa.y + wa.height / 2 - SETTINGS_H / 2),
    resizable: false,
    backgroundColor: uiBackground(),
    icon: path.join(__dirname, 'renderer', 'app-icon.png'),
    title: 'Pixel Pet - Cài đặt',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'settingsPreload.js'),
      contextIsolation: true,
    },
  });
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  const onSave = (_e, data) => {
    let patch;
    try {
      patch = splitBrainKey(data);
    } catch (err) {
      dialog.showErrorBox('Không lưu được key', err.message);
      return;
    }
    saved = true;
    applyConfig(saveConfigAndReturn(patch));
    if (tray && !tray.isDestroyed()) buildTrayMenu();
    settingsWin.close();
    if (isFirstRun) startApp();
  };
  ipcMain.on('settings-save', onSave);

  settingsWin.on('closed', () => {
    ipcMain.removeListener('settings-save', onSave);
    settingsWin = null;
    if (isFirstRun && !saved) {
      applyConfig(saveConfigAndReturn({}));
      startApp();
    }
  });
}

function saveConfigAndReturn(data) {
  const config = { ...loadConfig(), ...data, firstRunDone: true };
  saveConfig(config);
  return config;
}

// The stored key (encrypted or legacy plaintext) stays in the main process; the form only learns whether one exists.
ipcMain.handle('settings-get-initial', () => {
  const { brainKeyEnc, xaiApiKey, ...config } = petConfig || loadConfig();
  return {
    ...config,
    defaultGreetings: DEFAULT_GREETINGS,
    isFirstRun: settingsFirstRun,
    hasStoredKey: !!(brainKeyEnc || xaiApiKey),
    hasEnvKey: !!(process.env.BRAIN_API_KEY || process.env.XAI_API_KEY),
  };
});

ipcMain.handle('brain-test', (_e, form) => {
  const cur = petConfig || loadConfig();
  const apiKey = form.apiKey || (sameHost(form.endpoint, cur.brainEndpoint) ? brainKeyFor(cur) : '');
  return brain.test({ endpoint: form.endpoint, model: form.model, reasoningEffort: form.reasoningEffort, apiKey });
});

function startApp() {
  createWindow();

  tray = new Tray(path.join(__dirname, 'renderer', 'tray-icon.png'));
  tray.setToolTip(petConfig.petName);
  buildTrayMenu();
  scheduleCareMessage();
  if (petConfig.awareness) setAwareness(true);

  screen.on('display-metrics-changed', () => {
    currentX = clampX(currentX);
  });
}

app.whenReady().then(() => {
  const loginSettings = app.getLoginItemSettings();
  if (app.isPackaged && !loginSettings.openAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  const config = loadConfig();
  if (!config.firstRunDone || !config.petModel) {
    createModelPickerWindow(!config.firstRunDone);
    return;
  }

  applyConfig(config);
  const delay = loginSettings.wasOpenedAtLogin ? LOGIN_START_DELAY_MS : 0;
  setTimeout(startApp, delay);
});

app.on('window-all-closed', () => app.quit());
