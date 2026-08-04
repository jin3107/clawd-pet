const petNameEl = document.getElementById('petName');
const greetingListEl = document.getElementById('greetingList');
const customGreetingsEl = document.getElementById('customGreetings');
const intervalMinEl = document.getElementById('intervalMin');
const intervalMaxEl = document.getElementById('intervalMax');
const errorEl = document.getElementById('error');
const saveEl = document.getElementById('save');

window.settingsAPI.getInitial().then((config) => {
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
    errorEl.textContent = 'Thời gian phải là số nguyên dương.';
    return;
  }
  if (intervalMaxMin < intervalMinMin) {
    errorEl.textContent = 'Giá trị "đến" phải lớn hơn hoặc bằng giá trị đầu.';
    return;
  }
  if (enabledGreetings.length === 0 && customGreetings.length === 0) {
    errorEl.textContent = 'Chọn ít nhất một câu mặc định hoặc tự nhập một câu.';
    return;
  }

  window.settingsAPI.save({
    petName,
    enabledGreetings,
    customGreetings,
    intervalMinMin,
    intervalMaxMin,
  });
});
