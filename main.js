const { app, BrowserWindow, screen, Tray, Menu, ipcMain } = require('electron');
const path = require('path');
const { DEFAULT_GREETINGS, loadConfig, saveConfig, greetingsFor } = require('./config');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.disableHardwareAcceleration();

const PET_W = 100;
const PET_H = 68;
const GROUND_PAD = 4;
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
const SETTINGS_W = 460;
const SETTINGS_H = 460;
const BUBBLE_W = 220;
const HEAD_ANCHOR_Y = 18;

const FAST_MS = 30;
const SLOW_MS = 150;
const STATIONARY = new Set(['idle', 'jump', 'code', 'music', 'soccer', 'pat', 'think', 'coffee']);

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
let codePhase = 'typing';
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

const DODGE_MARGIN = 8;
const DODGE_DIST = 260;
const DODGEABLE = new Set(['idle', 'code', 'jump', 'music', 'soccer', 'think', 'coffee', 'walk']);

function workArea() {
  return screen.getPrimaryDisplay().workArea;
}

function baseY() {
  const wa = workArea();
  return wa.y + wa.height - PET_H + GROUND_PAD;
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

function createBubbleWindow() {
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
  bubbleWin.loadFile(path.join(__dirname, 'renderer', 'bubble.html'));
}

function hideBubble() {
  if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.hide();
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

function nextAction() {
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

  if (Math.random() < 0.45) {
    state = 'walk';
    targetX = pickTarget(40);
    return;
  }

  const tricks = ['code', 'jump', 'music', 'soccer', 'climb', 'surf', 'think', 'coffee'];
  const trick = tricks[Math.floor(Math.random() * tricks.length)];
  switch (trick) {
    case 'code':
      state = 'code';
      codePhase = 'typing';
      frames = 250 + Math.random() * 250;
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
      else if (state === 'code' && codePhase === 'typing') {
        codePhase = 'closing';
        frames = 12;
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
    win.webContents.send('pet-state', { state: sentState, facing, careMsg: careBubbleActive });
    lastSentState = sentState;
    lastSentFacing = facing;
    lastSentCareMsg = careBubbleActive;
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
    showCareMessage();
    scheduleCareMessage();
  }, delay);
}

function showCareMessage() {
  if (!win || win.isDestroyed() || dragging || state === 'fall' || state === 'climb') return;
  const msg = CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)];
  state = 'think';
  frames = Math.max(200, Math.min(360, msg.length * 9));
  careBubbleActive = true;
  if (bubbleWin && !bubbleWin.isDestroyed()) bubbleWin.webContents.send('bubble-text', msg);
}

function buildTrayMenu() {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: `Version ${app.getVersion()}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Chạy cùng Windows',
        type: 'checkbox',
        checked: openAtLogin,
        click: (item) => {
          app.setLoginItemSettings({ openAtLogin: item.checked });
          buildTrayMenu();
        },
      },
      { label: 'Cài đặt...', click: () => createSettingsWindow(false) },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() },
    ])
  );
}

function applyConfig(config) {
  petConfig = config;
  CARE_MESSAGES = greetingsFor(config);
  CARE_MIN_MS = config.intervalMinMin * 60 * 1000;
  CARE_MAX_MS = config.intervalMaxMin * 60 * 1000;
  if (tray && !tray.isDestroyed()) tray.setToolTip(config.petName);
}

let settingsWin = null;

function createSettingsWindow(isFirstRun) {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }

  const wa = workArea();
  let saved = false;

  settingsWin = new BrowserWindow({
    width: SETTINGS_W,
    height: SETTINGS_H,
    x: Math.round(wa.x + wa.width / 2 - SETTINGS_W / 2),
    y: Math.round(wa.y + wa.height / 2 - SETTINGS_H / 2),
    resizable: false,
    title: 'Clawd Pet - Cài đặt',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'settingsPreload.js'),
      contextIsolation: true,
    },
  });
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));

  const onSave = (_e, data) => {
    saved = true;
    applyConfig(saveConfigAndReturn(data));
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

ipcMain.handle('settings-get-initial', () => ({
  ...(petConfig || loadConfig()),
  defaultGreetings: DEFAULT_GREETINGS,
}));

function startApp() {
  createWindow();
  createBubbleWindow();

  tray = new Tray(path.join(__dirname, 'renderer', 'tray-icon.png'));
  tray.setToolTip(petConfig.petName);
  buildTrayMenu();
  scheduleCareMessage();

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
  if (!config.firstRunDone) {
    createSettingsWindow(true);
    return;
  }

  applyConfig(config);
  const delay = loginSettings.wasOpenedAtLogin ? LOGIN_START_DELAY_MS : 0;
  setTimeout(startApp, delay);
});

app.on('window-all-closed', () => app.quit());
