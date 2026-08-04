const fs = require('fs');
const path = require('path');
const { app } = require('electron');

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
  petName: 'Pixel Pet',
  enabledGreetings: [...DEFAULT_GREETINGS],
  customGreetings: [],
  intervalMinMin: 60,
  intervalMaxMin: 75,
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

module.exports = { DEFAULT_GREETINGS, DEFAULT_CONFIG, loadConfig, saveConfig, greetingsFor };
