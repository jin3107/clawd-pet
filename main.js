const { app, BrowserWindow, screen, Tray, Menu, ipcMain, Notification } = require('electron');
const path = require('path');

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

const CARE_MESSAGES = [
  'Uống nước chưa đó?',
  'Ngồi lâu rồi, đứng dậy vươn vai xíu đi.',
  'Nay ổn không?',
  'Nhớ ăn uống đúng giờ nha.',
  'Mỏi mắt chưa? Nhìn ra xa xíu đi.',
  'Làm việc mệt thì nghỉ chút đã, không vội đâu.',
  'Vẫn đang ở đây với bạn nè.',
];
const CARE_MIN_MS = 15 * 60 * 1000;
const CARE_MAX_MS = 30 * 60 * 1000;
const LOGIN_START_DELAY_MS = 45 * 1000;

const FAST_MS = 30;
const SLOW_MS = 150;
const STATIONARY = new Set(['idle', 'jump', 'code', 'music', 'soccer', 'pat', 'think', 'coffee']);

let win;
let tray;
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
let scheduledDelay = FAST_MS;

let dragging = false;
let dragOffX = 0;
let dragOffY = 0;
let vy = 0;
let patting = false;
let lastCursor = { x: 0, y: 0 };
let lastCursorMove = Date.now();
let tickN = 0;

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
  if (sentState !== lastSentState || facing !== lastSentFacing) {
    win.webContents.send('pet-state', { state: sentState, facing });
    lastSentState = sentState;
    lastSentFacing = facing;
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
    if (Notification.isSupported()) {
      const msg = CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)];
      new Notification({
        title: 'Clawd',
        body: msg,
        icon: path.join(__dirname, 'renderer', 'tray-icon.png'),
      }).show();
    }
    scheduleCareMessage();
  }, delay);
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
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() },
    ])
  );
}

function startApp() {
  createWindow();

  tray = new Tray(path.join(__dirname, 'renderer', 'tray-icon.png'));
  tray.setToolTip('Pixel Pet');
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

  const delay = loginSettings.wasOpenedAtLogin ? LOGIN_START_DELAY_MS : 0;
  setTimeout(startApp, delay);
});

app.on('window-all-closed', () => app.quit());
