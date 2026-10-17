export const CARE_MESSAGES = [
  'Uống nước chưa đó?',
  'Ngồi lâu rồi, đứng dậy vươn vai xíu đi.',
  'Nay ổn không?',
  'Nhớ ăn uống đúng giờ nha.',
  'Mỏi mắt chưa? Nhìn ra xa xíu đi.',
  'Làm việc mệt thì nghỉ chút đã, không vội đâu.',
  'Vẫn đang ở đây với bạn nè.',
];

// Same cadence as the desktop build (60-75 min). `?careMin=0.1&careMax=0.2` (minutes) overrides it for testing.
export function careIntervalMs(): [number, number] {
  const q = new URLSearchParams(location.search);
  const min = Number(q.get('careMin')) || 60;
  const max = Math.max(min, Number(q.get('careMax')) || 75);
  return [min * 60_000, max * 60_000];
}
