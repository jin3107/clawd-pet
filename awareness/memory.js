const KEEP_MS = 2 * 60 * 60 * 1000;
const SESSION_BREAK_MS = 5 * 60 * 1000;
const SWITCH_WINDOW_MS = 10 * 60 * 1000;

// In-memory timeline of what the user was doing. Deliberately not persisted: a restart starts a fresh picture, and no
// window titles ever touch the disk.
const events = []; // { ts, app, category } — one entry per change of app or category
let current = null; // { app, title, category, since }
let sessionStart = null; // start of the current stretch without a >=5min away gap
let awayStart = null;
let returnedAfterMs = 0;

function push(s) {
  if (s.category === 'away') {
    if (awayStart === null) awayStart = s.ts;
    current = { app: '', title: '', category: 'away', since: current?.category === 'away' ? current.since : s.ts };
    return;
  }

  if (awayStart !== null) {
    const away = s.ts - awayStart;
    returnedAfterMs = away;
    if (away >= SESSION_BREAK_MS) sessionStart = s.ts;
    awayStart = null;
  } else {
    returnedAfterMs = 0;
  }
  if (sessionStart === null) sessionStart = s.ts;

  if (!current || current.app !== s.app || current.category !== s.category) {
    events.push({ ts: s.ts, app: s.app, category: s.category });
    current = { app: s.app, title: s.title, category: s.category, since: s.ts };
  } else {
    current.title = s.title;
  }

  while (events.length && s.ts - events[0].ts > KEEP_MS) events.shift();
}

function snapshot(now = Date.now()) {
  if (!current) return null;
  const switches = events.filter((e) => now - e.ts <= SWITCH_WINDOW_MS && e.category !== 'away').length;
  return {
    category: current.category,
    app: current.app,
    title: current.title,
    sinceMs: now - current.since,
    sessionMs: sessionStart === null ? 0 : now - sessionStart,
    switches10m: switches,
    returnedAfterMs,
  };
}

// Consumed by the gate after it reacts, so "just came back" fires once instead of on every sample.
function clearReturn() {
  returnedAfterMs = 0;
}

module.exports = { push, snapshot, clearReturn };
