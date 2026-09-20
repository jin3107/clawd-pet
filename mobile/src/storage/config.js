import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'clawd-pet:config';

export const DEFAULT_GREETINGS = [
  'Uống nước chưa đó?',
  'Ngồi lâu rồi, đứng dậy vươn vai xíu đi.',
  'Nay ổn không?',
  'Nhớ ăn uống đúng giờ nha.',
  'Mỏi mắt chưa? Nhìn ra xa xíu đi.',
  'Làm việc mệt thì nghỉ chút đã, không vội đâu.',
  'Vẫn đang ở đây với bạn nè.',
];

export const DEFAULT_CONFIG = {
  petName: 'Clawd Pet',
  enabledGreetings: [...DEFAULT_GREETINGS],
  customGreetings: [],
  intervalMinMin: 60,
  intervalMaxMin: 75,
};

export async function loadConfig() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function greetingsFor(config) {
  const list = [...(config.enabledGreetings || []), ...(config.customGreetings || [])];
  return list.length > 0 ? list : DEFAULT_GREETINGS;
}
