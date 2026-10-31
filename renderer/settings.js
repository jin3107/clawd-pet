const petNameEl = document.getElementById('petName');
const greetingListEl = document.getElementById('greetingList');
const customGreetingsEl = document.getElementById('customGreetings');
const intervalMinEl = document.getElementById('intervalMin');
const intervalMaxEl = document.getElementById('intervalMax');
const errorEl = document.getElementById('error');
const saveEl = document.getElementById('save');
const titleEl = document.getElementById('title');

const brainOnEl = document.getElementById('brainOn');
const brainFieldsEl = document.getElementById('brainFields');
const providerEl = document.getElementById('provider');
const brainModelEl = document.getElementById('brainModel');
const brainKeyEl = document.getElementById('brainKey');
const keyFieldEl = document.getElementById('keyField');
const keyHintEl = document.getElementById('keyHint');
const clearKeyRowEl = document.getElementById('clearKeyRow');
const clearKeyEl = document.getElementById('clearKey');
const brainEndpointEl = document.getElementById('brainEndpoint');
const brainEffortEl = document.getElementById('brainEffort');
const testEl = document.getElementById('test');
const testResultEl = document.getElementById('testResult');

// Model names are the providers' own and change over time; the field stays editable and the hint says so.
const PROVIDERS = {
  groq: {
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-20b',
    effort: 'low',
  },
  gemini: {
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    effort: '',
  },
  xai: {
    label: 'xAI (Grok)',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-3-mini',
    effort: '',
  },
  ollama: {
    label: 'Ollama (chạy trên máy, không cần key)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    model: 'qwen2.5:1.5b',
    effort: '',
  },
  custom: { label: 'Tuỳ chỉnh (OpenAI-compatible)', endpoint: '', model: '', effort: '' },
};

let initial = null; // config as loaded, to tell whether the endpoint host changed

function showTab(id) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === id));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `panel-${id}`; });
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

// An error from a tab that is not on screen would look like Save did nothing, so jump to the tab that owns it.
function fail(message, tab) {
  errorEl.textContent = message;
  showTab(tab);
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function isLocal(url) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function providerFor(endpoint) {
  return Object.keys(PROVIDERS).find((id) => id !== 'custom' && PROVIDERS[id].endpoint === endpoint) || 'custom';
}

function hostChanged() {
  return hostOf(brainEndpointEl.value.trim()) !== hostOf(initial.brainEndpoint);
}

// A stored key belongs to the provider it was saved for, so it only counts while the host is unchanged.
function storedKeyUsable() {
  return initial.hasStoredKey && !hostChanged() && !clearKeyEl.checked;
}

function refreshKeyUi() {
  const local = isLocal(brainEndpointEl.value.trim());
  keyFieldEl.style.display = local ? 'none' : '';
  clearKeyRowEl.style.display = initial.hasStoredKey && !hostChanged() ? '' : 'none';

  if (initial.hasEnvKey) {
    keyHintEl.textContent = 'Đang dùng biến môi trường BRAIN_API_KEY (được ưu tiên hơn key lưu ở đây).';
  } else if (initial.hasStoredKey && hostChanged()) {
    keyHintEl.textContent = 'Đã đổi nhà cung cấp: key cũ sẽ bị xoá, hãy nhập key mới.';
  } else if (initial.hasStoredKey) {
    keyHintEl.textContent = 'Đã lưu một key (mã hoá, không hiển thị lại). Để trống để giữ nguyên.';
  } else {
    keyHintEl.textContent = 'Key được mã hoá trên máy này trước khi lưu.';
  }
}

function applyProvider(id) {
  const p = PROVIDERS[id];
  if (id !== 'custom') {
    brainEndpointEl.value = p.endpoint;
    brainModelEl.value = p.model;
    brainEffortEl.value = p.effort;
  }
  refreshKeyUi();
}

function setBrainEnabled(on) {
  brainFieldsEl.classList.toggle('off', !on);
}

Object.entries(PROVIDERS).forEach(([id, p]) => {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = p.label;
  providerEl.appendChild(opt);
});

providerEl.addEventListener('change', () => applyProvider(providerEl.value));
brainOnEl.addEventListener('change', () => setBrainEnabled(brainOnEl.checked));
clearKeyEl.addEventListener('change', refreshKeyUi);
brainEndpointEl.addEventListener('input', () => {
  providerEl.value = providerFor(brainEndpointEl.value.trim());
  refreshKeyUi();
});

window.settingsAPI.getInitial().then((config) => {
  initial = config;
  titleEl.textContent = config.isFirstRun ? 'Chào bạn! Đặt tên và tuỳ chỉnh cho pet của bạn nhé' : 'Cài đặt';
  saveEl.textContent = config.isFirstRun ? 'Lưu và bắt đầu' : 'Lưu';

  petNameEl.value = config.petName;
  intervalMinEl.value = config.intervalMinMin;
  intervalMaxEl.value = config.intervalMaxMin;
  customGreetingsEl.value = config.customGreetings.join('\n');

  greetingListEl.innerHTML = '';
  config.defaultGreetings.forEach((msg, i) => {
    const id = `greet_${i}`;
    const row = document.createElement('div');
    row.className = 'check-row';
    row.innerHTML = `
      <input type="checkbox" id="${id}" value="${i}" ${config.enabledGreetings.includes(msg) ? 'checked' : ''}>
      <label for="${id}"></label>
    `;
    row.querySelector('label').textContent = msg;
    greetingListEl.appendChild(row);
  });

  brainOnEl.checked = !!config.brain;
  setBrainEnabled(brainOnEl.checked);
  brainEndpointEl.value = config.brainEndpoint;
  brainModelEl.value = config.brainModel;
  brainEffortEl.value = config.brainReasoningEffort || '';
  providerEl.value = providerFor(config.brainEndpoint);
  refreshKeyUi();
});

testEl.addEventListener('click', async () => {
  const endpoint = brainEndpointEl.value.trim();
  if (!hostOf(endpoint)) {
    testResultEl.className = 'fail';
    testResultEl.textContent = 'Endpoint không hợp lệ.';
    return;
  }
  testEl.disabled = true;
  testResultEl.className = '';
  testResultEl.textContent = 'Đang thử...';
  const res = await window.settingsAPI.testBrain({
    endpoint,
    model: brainModelEl.value.trim(),
    reasoningEffort: brainEffortEl.value,
    apiKey: brainKeyEl.value.trim(),
  });
  testResultEl.className = res.ok ? 'ok' : 'fail';
  testResultEl.textContent = res.message;
  testEl.disabled = false;
});

saveEl.addEventListener('click', () => {
  const petName = petNameEl.value.trim() || 'Pixel Pet';
  const enabledGreetings = Array.from(greetingListEl.querySelectorAll('input[type="checkbox"]:checked'))
    .map((el) => el.nextElementSibling.textContent);
  const customGreetings = customGreetingsEl.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  const intervalMinMin = parseInt(intervalMinEl.value, 10);
  const intervalMaxMin = parseInt(intervalMaxEl.value, 10);

  if (!Number.isFinite(intervalMinMin) || !Number.isFinite(intervalMaxMin) || intervalMinMin < 1) {
    fail('Thời gian phải là số nguyên dương.', 'general');
    return;
  }
  if (intervalMaxMin < intervalMinMin) {
    fail('Giá trị "đến" phải lớn hơn hoặc bằng giá trị đầu.', 'general');
    return;
  }
  if (enabledGreetings.length === 0 && customGreetings.length === 0) {
    fail('Chọn ít nhất một câu mặc định hoặc tự nhập một câu.', 'general');
    return;
  }

  const brainEndpoint = brainEndpointEl.value.trim();
  const brainModel = brainModelEl.value.trim();
  const typedKey = brainKeyEl.value.trim();
  if (brainOnEl.checked) {
    if (!hostOf(brainEndpoint)) {
      fail('Mini brain: endpoint không hợp lệ.', 'brain');
      return;
    }
    if (!brainModel) {
      fail('Mini brain: chưa nhập tên model.', 'brain');
      return;
    }
    if (!isLocal(brainEndpoint) && !typedKey && !initial.hasEnvKey && !storedKeyUsable()) {
      fail('Mini brain: cần nhập API key cho nhà cung cấp này.', 'brain');
      return;
    }
  }

  errorEl.textContent = '';
  window.settingsAPI.save({
    petName,
    enabledGreetings,
    customGreetings,
    intervalMinMin,
    intervalMaxMin,
    brain: brainOnEl.checked,
    // With the brain off, half-filled fields fall back to what was saved rather than persisting an empty endpoint/model.
    brainEndpoint: hostOf(brainEndpoint) ? brainEndpoint : initial.brainEndpoint,
    brainModel: brainModel || initial.brainModel,
    brainReasoningEffort: brainEffortEl.value,
    brainApiKey: typedKey,
    clearBrainKey: clearKeyEl.checked,
  });
});
