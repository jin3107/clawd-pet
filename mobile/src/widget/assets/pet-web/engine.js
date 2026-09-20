// Clawd Pet — mobile engine.
// Merges desktop main.js (tick loop / state machine), preload.js (bridge) and
// renderer/pet.js (class toggling) into one script that runs directly inside
// the WebView. No Electron, no IPC, no OS window movement — the creature is
// translated with CSS transform inside the fixed-size box the WebView itself
// already clips to.

(function () {
  const PET_W = 100;
  const PET_H = 65;
  const GROUND_PAD = 4;
  const WALK_SPEED = 1.6;
  const SURF_SPEED = 4.5;
  const CLIMB_SPEED = 1.2;
  const AFK_MS = 12000;

  const FAST_MS = 30;
  const SLOW_MS = 150;
  const STATIONARY = new Set(['idle', 'jump', 'code', 'music', 'soccer', 'pat', 'think', 'coffee']);
  const STATES = ['walk', 'idle', 'surf', 'climb', 'code', 'jump', 'music', 'soccer', 'held', 'fall', 'pat', 'think', 'coffee'];

  const stage = document.getElementById('stage');
  const petRoot = document.getElementById('pet-root');
  const creature = document.getElementById('creature');
  const flipGroup = document.getElementById('flip-group');
  const headZone = document.getElementById('head-zone');
  const bubbleWrap = document.getElementById('bubble-wrap');
  const bubbleText = document.getElementById('bubble-text');

  let settings = window.__PET_SETTINGS__ || {
    petName: 'Clawd Pet',
    greetings: ['Vẫn đang ở đây với bạn nè.'],
    intervalMinMin: 60,
    intervalMaxMin: 75,
  };

  function boxSize() {
    return { w: stage.clientWidth || PET_W, h: stage.clientHeight || PET_H };
  }

  function baseY() {
    const { h } = boxSize();
    return h - PET_H + GROUND_PAD;
  }

  function clampX(x) {
    const { w } = boxSize();
    return Math.min(Math.max(x, 0), Math.max(0, w - PET_W));
  }

  function climbTop() {
    const { h } = boxSize();
    return Math.max(0, baseY() - Math.min(90, h - PET_H));
  }

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
  let scheduledDelay = FAST_MS;
  let tickN = 0;

  let dragging = false;
  let dragOffX = 0;
  let dragOffY = 0;
  let vy = 0;
  let patting = false;

  let careBubbleActive = false;
  let careTimer = null;

  function startIdle() {
    state = 'idle';
    frames = 60 + Math.random() * 180;
  }

  function pickTarget(minDist) {
    const { w } = boxSize();
    const maxX = Math.max(0, w - PET_W);
    let t;
    let tries = 0;
    do {
      t = Math.random() * maxX;
    } while (Math.abs(t - currentX) < minDist && ++tries < 20);
    return t;
  }

  // No ambient cursor on mobile, so the "AFK" branch from desktop's
  // nextAction() (walk-to-cursor / dodge) is dropped — always use the
  // regular trick pool.
  function nextAction() {
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
        targetX = pickTarget(Math.max(60, boxSize().w * 0.4));
        break;
    }
  }

  function applyState({ state: s, facing: f, careMsg }) {
    const base =
      s.startsWith('climb') ? 'climb' :
      s.startsWith('code') ? 'code' :
      s.startsWith('coffee') ? 'coffee' :
      s.startsWith('fall') ? 'fall' : s;
    STATES.forEach((st) => document.body.classList.toggle(st, st === base));
    document.body.classList.toggle('hang', s === 'climb-pause');
    document.body.classList.toggle('closing', s === 'code-closing');
    document.body.classList.toggle('sipping', s === 'coffee-sip');
    document.body.classList.toggle('chute', s.startsWith('fall') && s.includes('chute'));
    document.body.classList.toggle('scared', s.startsWith('fall') && s.includes('scared'));
    document.body.classList.toggle('care-msg', !!careMsg);
    flipGroup.style.transform = `scaleX(${f})`;
  }

  function tick() {
    tickN++;
    const by = baseY();

    if (dragging) {
      state = 'held';
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
          currentX += facing * WALK_SPEED * 2;
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
      const topY = climbTop();
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

    currentX = clampX(currentX);
    petRoot.style.transform = `translate(${Math.round(currentX)}px, ${Math.round(currentY)}px)`;

    const sentState =
      state === 'climb' ? `climb-${climbPhase}` :
      state === 'code' ? `code-${codePhase}` :
      state === 'coffee' ? `coffee-${coffeePhase}` :
      state === 'fall' ? `fall${fallChute ? '-chute' : ''}${fallScared ? '-scared' : ''}` :
      state;
    applyState({ state: sentState, facing, careMsg: careBubbleActive });

    const nextDelay = !dragging && STATIONARY.has(state) ? SLOW_MS : FAST_MS;
    scheduledDelay = nextDelay;
    setTimeout(tick, nextDelay);
  }

  // ── Pointer interaction (touch works the same as mouse via Pointer Events) ──

  let held = false;

  creature.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    held = true;
    patting = false;
    dragging = true;
    if (careBubbleActive) {
      careBubbleActive = false;
      hideBubble();
    }
    const rect = petRoot.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const stageRect = stage.getBoundingClientRect();
    currentX = clampX(e.clientX - stageRect.left - dragOffX);
    currentY = e.clientY - stageRect.top - dragOffY;
    const { h } = boxSize();
    currentY = Math.min(Math.max(currentY, -PET_H), h - 4);
  });

  window.addEventListener('pointerup', () => {
    if (!held) return;
    held = false;
    dragging = false;
    vy = 0;
    state = 'fall';
    fallChute = Math.random() < 0.35;
    fallScared = Math.random() < 0.5;
  });

  headZone.addEventListener('pointerdown', (e) => {
    // Head-zone tap = pat, not drag: stop the body-level handler above.
    e.stopPropagation();
    e.preventDefault();
    patting = true;
  });
  headZone.addEventListener('pointerup', () => { patting = false; });
  headZone.addEventListener('pointercancel', () => { patting = false; });

  // ── Blink (unchanged from desktop renderer/pet.js) ──

  function scheduleBlink() {
    const delay = 3500 + Math.random() * 4000;
    setTimeout(() => {
      document.querySelectorAll('.eye').forEach((e) => e.classList.add('blinking'));
      setTimeout(() => {
        document.querySelectorAll('.eye').forEach((e) => e.classList.remove('blinking'));
        scheduleBlink();
      }, 250);
    }, delay);
  }

  // ── Care-message bubble (was a separate always-on-top window on desktop;
  //    here it's just a div anchored above the pet's own translated box) ──

  function hideBubble() {
    bubbleWrap.classList.remove('show');
  }

  function showCareMessage() {
    if (dragging || state === 'fall' || state === 'climb') return;
    const list = (settings.greetings && settings.greetings.length) ? settings.greetings : ['Vẫn đang ở đây với bạn nè.'];
    const msg = list[Math.floor(Math.random() * list.length)];
    state = 'think';
    frames = Math.max(200, Math.min(360, msg.length * 9));
    careBubbleActive = true;
    bubbleText.textContent = msg;
    bubbleWrap.classList.add('show');
  }

  function scheduleCareMessage() {
    if (careTimer) clearTimeout(careTimer);
    const minMs = (settings.intervalMinMin || 60) * 60 * 1000;
    const maxMs = (settings.intervalMaxMin || 75) * 60 * 1000;
    const delay = minMs + Math.random() * Math.max(0, maxMs - minMs);
    careTimer = setTimeout(() => {
      showCareMessage();
      scheduleCareMessage();
    }, delay);
  }

  // ── Bridge: settings pushed from React Native (initial + live updates) ──

  window.__applyPetSettings = function (next) {
    settings = { ...settings, ...next };
    scheduleCareMessage();
  };

  window.addEventListener('resize', () => {
    currentX = clampX(currentX);
  });

  // ── Boot ──

  currentX = clampX(boxSize().w / 2 - PET_W / 2);
  currentY = baseY();
  petRoot.style.transform = `translate(${Math.round(currentX)}px, ${Math.round(currentY)}px)`;
  scheduleBlink();
  scheduleCareMessage();
  setTimeout(tick, FAST_MS);
})();
