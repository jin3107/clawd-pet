const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

const DEFAULT_GREETINGS = [
  'Uống nước chưa đó?',
  'Ngồi lâu rồi, đứng dậy vươn vai xíu đi.',
  'Nay ổn không?',
  'Nhớ ăn uống đúng giờ nha.',
  'Mỏi mắt chưa? Nhìn ra xa xíu đi.',
  'Làm việc mệt thì nghỉ chút đã, không vội đâu.',
  'Vẫn đang ở đây với bạn nè.',
];

const DEFAULT_CONFIG = {
  firstRunDone: false,
  petModel: null, // 'clawd' | 'cat' | 'sheep' — null forces the model picker on first run
  petName: 'Pixel Pet',
  enabledGreetings: [...DEFAULT_GREETINGS],
  customGreetings: [],
  intervalMinMin: 60,
  intervalMaxMin: 75,
  awareness: false, // opt-in: watch the foreground app (never screenshots) so the pet reacts to what the user is doing
  brain: false, // opt-in: let an LLM pick the pet's next action (any OpenAI-compatible endpoint; key not needed for localhost)
  brainKeyEnc: '', // API key encrypted with safeStorage (DPAPI on Windows), base64; never sent to a renderer
  xaiApiKey: '', // legacy plaintext key from 1.7.0, still read as a fallback
  brainModel: 'openai/gpt-oss-20b',
  brainEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
  brainReasoningEffort: 'low', // 'low' | 'medium' | 'high' for reasoning models (gpt-oss); empty = omit the field
};

function configPath() {
  return path.join(app.getPath('userData'), 'pet-config.json');
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8');
}

function greetingsFor(config) {
  const list = [...(config.enabledGreetings || []), ...(config.customGreetings || [])];
  return list.length > 0 ? list : DEFAULT_GREETINGS;
}

// The app was renamed from clawd-pet to pixel-pet, which moves Electron's userData folder. Carry pet-config.json across
// once. The encrypted API key is left behind on purpose: safeStorage's key lives in each userData folder's Local State,
// so the old ciphertext cannot be decrypted here and would only show up as a "saved" key that never works.
function migrateLegacyConfig(prevDir, nextDir) {
  const prev = path.join(prevDir, 'pet-config.json');
  const next = path.join(nextDir, 'pet-config.json');
  try {
    if (fs.existsSync(next) || !fs.existsSync(prev)) return false;
    const config = JSON.parse(fs.readFileSync(prev, 'utf-8'));
    delete config.brainKeyEnc;
    fs.mkdirSync(nextDir, { recursive: true });
    fs.writeFileSync(next, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// Throws when the OS cannot encrypt (no keyring); the caller shows the error instead of falling back to plaintext.
function storeBrainKey(plain) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Máy này không hỗ trợ mã hoá key. Hãy đặt biến môi trường BRAIN_API_KEY thay thế.');
  return safeStorage.encryptString(plain).toString('base64');
}

// Env var wins over the stored key so a one-off override does not need the settings window.
function brainKeyFor(config) {
  const env = process.env.BRAIN_API_KEY || process.env.XAI_API_KEY;
  if (env) return env;
  if (config.brainKeyEnc) {
    try {
      return safeStorage.decryptString(Buffer.from(config.brainKeyEnc, 'base64'));
    } catch {
      return '';
    }
  }
  return config.xaiApiKey || '';
}

module.exports = {
  DEFAULT_GREETINGS, DEFAULT_CONFIG, loadConfig, saveConfig, greetingsFor, storeBrainKey, brainKeyFor, migrateLegacyConfig,
};
