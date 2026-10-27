const MIN = 60 * 1000;

const GLOBAL_COOLDOWN_MS = 25 * MIN;
const REASON_COOLDOWN_MS = 2 * 60 * MIN;
const SILENT_CATEGORIES = new Set(['game', 'private', 'away', 'video', 'music']);

const lastByReason = new Map();
let lastSpokenAt = 0;
let lastLine = '';

// Random pick that never repeats the line just shown, so back-to-back triggers don't feel canned.
const pick = (arr) => {
  const pool = arr.length > 1 ? arr.filter((l) => l !== lastLine) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
};
const mins = (ms) => Math.round(ms / MIN);
const hoursText = (ms) => {
  const m = mins(ms);
  if (m < 60) return `${m} phút`;
  return `${Math.floor(m / 60)} tiếng${m % 60 >= 30 ? ' rưỡi' : ''}`;
};

// Lines are built from the observed context (time spent, switches, away time), so they read differently from the
// generic greetings.
const LINES = {
  returned: (s) => [
    `Về rồi hả? Đi ${hoursText(s.returnedAfterMs)} đó.`,
    'Quay lại rồi nè. Nạp lại năng lượng chưa?',
    `Mình canh máy giúp bạn ${hoursText(s.returnedAfterMs)} rồi, không có gì xảy ra hết.`,
    'Có người về kìa. Mình đỡ buồn rồi.',
    'Đi đâu về đó? Kể mình nghe với.',
  ],
  thrash: () => [
    'Nhảy qua nhảy lại nhiều ghê, đang tìm gì hả?',
    'Alt-tab dữ vậy, có chỗ nào bí không?',
    'Cửa sổ nào cũng ghé một chút, chưa cái nào xong luôn hả?',
    'Mình chóng mặt theo bạn rồi đó. Chốt một việc làm cho xong đi.',
    'Bạn đang tìm thứ gì mà lục tung lên vậy?',
  ],
  long_social: (s) => [
    `Lướt ${hoursText(s.sinceMs)} rồi đó. Còn gì mới không mà dán mắt vậy?`,
    'Cuộn hoài mà chưa thấy đáy hả? Mình nghĩ là không có đáy đâu.',
    `${hoursText(s.sinceMs)} trên mạng xã hội rồi. Việc chính còn đợi kìa.`,
    'Thôi đặt điện thoại hay tab đó xuống, cho mắt nghỉ chút.',
  ],
  long_focus: (s) => [
    `Cắm đầu làm ${hoursText(s.sessionMs)} rồi đó. Bí hay đang cuốn?`,
    `${hoursText(s.sessionMs)} liền rồi, đứng dậy đi vài bước đã.`,
    `Bạn làm ${hoursText(s.sessionMs)} không nghỉ. Mình lo cho cái lưng bạn đó.`,
    'Đang cuốn thì cứ làm, nhưng uống ngụm nước rồi làm tiếp nha.',
    `Mình đếm rồi, ${hoursText(s.sessionMs)} chưa rời ghế. Duỗi người xíu đi.`,
  ],
  late_night: () => [
    'Khuya rồi mà vẫn còn làm. Mai dậy nổi không đó?',
    'Gần sáng rồi... chuyện này không gấp tới mức đó đâu.',
    'Giờ này người ta ngủ hết rồi. Bạn với mình thôi à?',
    'Cái bug đó sáng mai nhìn lại sẽ thấy dễ hơn, tin mình đi.',
    'Đi ngủ đi, mình canh máy cho.',
  ],
  long_session: (s) => [
    `Ngồi máy ${hoursText(s.sessionMs)} rồi. Uống miếng nước đi.`,
    'Mắt chắc mỏi rồi, nhìn ra xa 20 giây thử.',
    `${hoursText(s.sessionMs)} trước màn hình rồi đó, đứng dậy đi lại chút đi.`,
    'Vai bạn đang gồng đó, thả lỏng xuống thử xem.',
  ],
};

function reasonFor(s, now) {
  if (s.returnedAfterMs >= 15 * MIN) return 'returned';
  if (s.switches10m >= 12) return 'thrash';
  if (s.category === 'social' && s.sinceMs >= 40 * MIN) return 'long_social';
  if ((s.category === 'coding' || s.category === 'docs') && s.sessionMs >= 90 * MIN) return 'long_focus';
  const h = new Date(now).getHours();
  if (h >= 1 && h < 5 && s.sessionMs >= 20 * MIN) return 'late_night';
  if (s.sessionMs >= 150 * MIN) return 'long_session';
  return null;
}

// Returns { reason, text, commit } or null. The caller calls commit() only if the pet actually showed the line, so a
// refused attempt (pet mid-fall, being dragged) does not burn the cooldown.
function evaluate(snap, fullscreen, now = Date.now()) {
  if (!snap || fullscreen || SILENT_CATEGORIES.has(snap.category)) return null;
  if (now - lastSpokenAt < GLOBAL_COOLDOWN_MS) return null;

  const reason = reasonFor(snap, now);
  if (!reason) return null;
  if (now - (lastByReason.get(reason) || 0) < REASON_COOLDOWN_MS) return null;

  const text = pick(LINES[reason](snap));
  return {
    reason,
    text,
    commit: () => {
      lastSpokenAt = now;
      lastByReason.set(reason, now);
      lastLine = text;
    },
  };
}

// Dev helper: a random line built from a fake snapshot, to eyeball the bubble without waiting for a real trigger.
function previewLine() {
  const fake = { sessionMs: 100 * MIN, sinceMs: 45 * MIN, returnedAfterMs: 20 * MIN, switches10m: 14, category: 'coding' };
  const reason = Object.keys(LINES)[Math.floor(Math.random() * Object.keys(LINES).length)];
  const text = pick(LINES[reason](fake));
  lastLine = text;
  return text;
}

module.exports = { evaluate, previewLine };
