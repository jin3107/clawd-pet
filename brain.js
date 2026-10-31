const DEFAULT_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const DEFAULT_MODEL = 'grok-3-mini';

const COOLDOWN_MS = 30 * 1000;
const ERROR_BACKOFF_MS = 5 * 60 * 1000;
const SAY_COOLDOWN_MS = 90 * 1000;
const SAY_CHANCE = 0.3;
const TIMEOUT_MS = 8000;
const DECISION_TTL_MS = 20 * 1000;
const HISTORY = 4;

// Same sets nextAction() rolls from, so the brain can never ask for a prop the current sprite does not have.
const STATES_BY_MODEL = {
  clawd: ['idle', 'walk', 'code', 'jump', 'music', 'soccer', 'climb', 'surf', 'think', 'coffee'],
  cat: ['idle', 'walk', 'jump', 'climb', 'think', 'butterfly'],
  sheep: ['idle', 'walk', 'jump', 'climb', 'think'],
};

let settings = { enabled: false, apiKey: '', model: DEFAULT_MODEL, endpoint: DEFAULT_ENDPOINT };
let pending = false;
let busyUntil = 0; // cooldown after a request, longer after a failure
let lastSayAt = 0;
let decision = null; // { state, say, at } waiting for the next decision point
let recent = [];
let abort = null;

function configure(next) {
  settings = { ...settings, ...next };
  if (!isOn()) reset();
}

// A local server (Ollama, LM Studio) needs no key.
function isLocal(endpoint) {
  try {
    const h = new URL(endpoint).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
}

function isConfigured() {
  return !!(settings.apiKey || isLocal(settings.endpoint));
}

function isOn() {
  return settings.enabled && isConfigured();
}

function reset() {
  if (abort) abort.abort();
  abort = null;
  pending = false;
  decision = null;
}

function allowedStates(model) {
  return STATES_BY_MODEL[model] || STATES_BY_MODEL.clawd;
}

// True when a new request may go out. During cooldown/pending/error backoff the caller just runs its own state machine.
function ready(now = Date.now()) {
  return isOn() && !pending && now >= busyUntil;
}

// Returns the stored decision once, if it is still fresh; the caller applies it at its next decision point.
function take(now = Date.now()) {
  const d = decision;
  decision = null;
  if (!d || now - d.at > DECISION_TTL_MS) return null;
  return d;
}

function buildPrompt(ctx, states, sayAllowed) {
  const system =
    `You are the tiny brain of "${ctx.petName}", a ${ctx.model} pixel desktop pet. ` +
    `Pick what the pet does next. Reply with JSON only: {"state": <one of ${JSON.stringify(states)}>, "say": <string or null>}. ` +
    'Prefer variety and do not repeat your recent choices. ' +
    (sayAllowed
      ? '"say" is required this turn: one short line in Vietnamese, at most 10 words, in the voice of a dry, affectionate little pet. ' +
        'Plain text only, no emoji. Only mention what the user is doing if "User is currently" names a real activity; ' +
        'if it says other, stay generic (time of day, a small observation about yourself). Never guess apps or websites, never give orders.'
      : '"say" must be null.');
  const user =
    `Time ${ctx.hour}h. User is currently: ${ctx.activity}. Pet is ${ctx.state}. Recent choices: ${ctx.recent.join(', ') || 'none'}.`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

function parse(text, states, sayAllowed) {
  const m = /\{[\s\S]*\}/.exec(text || '');
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch { return null; }
  if (!states.includes(obj.state)) return null;
  let say = typeof obj.say === 'string' ? obj.say.trim() : '';
  if (!sayAllowed || say.length === 0 || say.length > 80) say = '';
  return { state: obj.state, say: say || null };
}

// Fire-and-forget: never throws, never blocks the caller. The result lands in `decision` for take().
function request(ctx) {
  if (!ready()) return;
  const now = Date.now();
  const states = allowedStates(ctx.model);
  // The odds are rolled here, not left to the model: asked for "about 1 in 5", an LLM just answers null every time.
  const sayAllowed = now - lastSayAt >= SAY_COOLDOWN_MS && Math.random() < SAY_CHANCE;
  pending = true;
  busyUntil = now + COOLDOWN_MS;
  const ac = new AbortController();
  abort = ac;
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);

  const headers = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;

  fetch(settings.endpoint || DEFAULT_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model || DEFAULT_MODEL,
      messages: buildPrompt({ ...ctx, recent }, states, sayAllowed),
      // Reasoning models spend part of this budget thinking before the JSON, so it needs headroom beyond the reply.
      max_tokens: 400,
      temperature: 1,
      ...(settings.reasoningEffort ? { reasoning_effort: settings.reasoningEffort } : {}),
    }),
    signal: ac.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      return res.json();
    })
    .then((json) => {
      const d = parse(json?.choices?.[0]?.message?.content, states, sayAllowed);
      if (!d) throw new Error(`bad reply: ${JSON.stringify(json?.choices?.[0]?.message?.content)}`);
      console.log(`[brain] decided state=${d.state} say=${d.say ? JSON.stringify(d.say) : 'none'}`);
      decision = { ...d, at: Date.now() };
      recent = [...recent, d.state].slice(-HISTORY);
      if (d.say) lastSayAt = Date.now();
    })
    .catch((err) => {
      // Out of credit, offline, 429, bad key, timeout: back off and let the state machine carry on.
      console.warn(`[brain] request failed: ${err.message}; backing off ${ERROR_BACKOFF_MS / 1000}s`);
      busyUntil = Date.now() + ERROR_BACKOFF_MS;
    })
    .finally(() => {
      clearTimeout(timer);
      if (abort === ac) abort = null;
      pending = false;
    });
}

module.exports = { configure, isOn, isConfigured, ready, request, take, allowedStates, DEFAULT_MODEL, DEFAULT_ENDPOINT };
