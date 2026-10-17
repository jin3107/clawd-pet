import type { Anim, Pose, SpriteConfig } from '../engine/types';
import { anim, group, rect } from './dsl';

const INK = '#242320';
const BODY = '#D9835F';
const LEG = '#C46F4D';
const CREAM = '#F2D9B8';

// ---- sprite tree (ported 1:1 from renderer/index.html #tpl-clawd) ----------

const heart = (x: number, y: number, n: string) =>
  group([rect(x, y, 3, 3), rect(x + 6, y, 3, 3), rect(x, y + 3, 9, 3), rect(x + 3, y + 6, 3, 3)], {
    names: ['heart', n],
  });

const eye = (x: number, y: number) => ({ ...rect(x, y, 8, 8, INK, ['eye']), origin: 'center' as const });

const parachute = group(
  [
    rect(28, -70, 24, 6, BODY),
    rect(10, -64, 19, 6, CREAM),
    rect(29, -64, 22, 6, BODY),
    rect(51, -64, 19, 6, CREAM),
    rect(-5, -58, 12, 7, BODY),
    rect(7, -58, 22, 7, CREAM),
    rect(29, -58, 22, 7, BODY),
    rect(51, -58, 22, 7, CREAM),
    rect(73, -58, 12, 7, BODY),
    rect(-15, -51, 22, 7, BODY),
    rect(7, -51, 22, 7, CREAM),
    rect(29, -51, 22, 7, BODY),
    rect(51, -51, 22, 7, CREAM),
    rect(73, -51, 22, 7, BODY),
    rect(-15, -44, 110, 2, '#8B5A3C'),
    group(
      [
        rect(-11, -42, 2, 12),
        rect(-6, -30, 2, 14),
        rect(0, -16, 2, 16),
        rect(89, -42, 2, 12),
        rect(84, -30, 2, 14),
        rect(78, -16, 2, 16),
      ],
      { fill: '#55555C' },
    ),
  ],
  { names: ['parachute'], hidden: true, origin: [40, -44] },
);

const legX = [10, 27.4, 44.8, 62.2];
const legs = group(
  legX.map((x, i) =>
    group([rect(x, 40, 7.8, 15)], {
      names: ['leg', i % 2 === 0 ? 'leg-a' : 'leg-b', `leg-${i + 1}`],
      origin: [0, 40],
    }),
  ),
  { fill: LEG },
);

const laptop = group(
  [
    group(
      [46, 41, 36, 31, 26, 21].map((y, i) => rect(86 + i * 1.5, y, 28, 5)),
      { fill: '#6E7987' },
    ),
    group(
      [[95, 35], [98, 32], [98, 38], [102, 38], [104, 35], [106, 32], [110, 32], [110, 38], [113, 35]].map(([x, y]) =>
        rect(x, y, 3, 3),
      ),
      { fill: '#F2F2F2' },
    ),
    rect(64, 51, 46, 4, '#5B6B7A'),
    group(
      [66, 72, 78, 84, 90, 96, 102].map((x) => rect(x, 52, 4, 2)),
      { fill: '#7C8CA0' },
    ),
  ],
  { names: ['laptop'], hidden: true, origin: [87, 53] },
);

const cup = group(
  [
    group(
      [rect(76, 1, 1.5, 3), rect(77.5, -2, 1.5, 3), rect(82, 1, 1.5, 3), rect(80.5, -2, 1.5, 3)],
      { names: ['steam'], fill: '#ABABAB' },
    ),
    rect(74, 7, 12, 10, '#F2E9DC'),
    rect(76, 7, 8, 2, '#4A2E1E'),
    rect(86, 9, 4, 1.5, '#F2E9DC'),
    rect(88.5, 9, 1.5, 5, '#F2E9DC'),
    rect(86, 12.5, 4, 1.5, '#F2E9DC'),
  ],
  { names: ['cup'], hidden: true },
);

const root = group(
  [
    group(
      [
        group(
          [
            group([heart(14, -14, 'heart-1'), heart(52, -12, 'heart-2')], { names: ['hearts'], hidden: true, fill: '#E06C9F' }),
            rect(10, 0, 60, 40, BODY),
            group([eye(16, 6), eye(56, 6)], { names: ['eyes-n'] }),
            group(
              [rect(15, 10, 4, 4), rect(19, 6, 4, 4), rect(23, 10, 4, 4), rect(55, 10, 4, 4), rect(59, 6, 4, 4), rect(63, 10, 4, 4)],
              { names: ['eyes-h'], hidden: true, fill: INK },
            ),
            group(
              [rect(16, 6, 4, 4), rect(16, 14, 4, 4), rect(22, 10, 4, 4), rect(60, 6, 4, 4), rect(60, 14, 4, 4), rect(54, 10, 4, 4)],
              { names: ['eyes-x'], hidden: true, fill: INK },
            ),
            parachute,
            legs,
            group(
              [rect(68, 8, 7.5, 7.5, '#ECECEC'), rect(75.5, 8, 7.5, 7.5, INK), rect(68, 15.5, 7.5, 7.5, INK), rect(75.5, 15.5, 7.5, 7.5, '#ECECEC')],
              { names: ['ball'], hidden: true },
            ),
            laptop,
            rect(-7, 14, 17, 12, BODY, ['arm', 'arm-l']),
            rect(70, 14, 17, 12, BODY, ['arm', 'arm-r']),
            group([rect(8, -2, 64, 6, '#3B3B42'), rect(2, 4, 10, 14, '#A9CDC7'), rect(68, 4, 10, 14, '#A9CDC7')], {
              names: ['headphones'],
              hidden: true,
            }),
            group([rect(6, 34, 68, 6, '#55555C'), rect(16, 26, 14, 10, '#3B7FC4'), rect(50, 26, 14, 10, '#ECECEC')], {
              names: ['dj-table'],
              hidden: true,
            }),
            group(
              [group([rect(76, -4, 2, 9), rect(72, 2, 4, 4), rect(76, -4, 5, 2)], { names: ['note', 'note-1'], fill: '#3B3B42' })],
              { names: ['notes'], hidden: true },
            ),
            cup,
            group(
              [rect(30, -28, 20, 14), rect(26, -24, 6, 6), rect(50, -24, 6, 6), rect(34, -10, 4, 4), rect(27, -4, 3, 3)],
              { names: ['think-bubble'], hidden: true, fill: '#F2F2F2', origin: [40, -21] },
            ),
          ],
          { names: ['bob'], origin: [40, 40] },
        ),
        group([rect(-6, 52, 92, 8, '#C15F8B'), rect(-6, 52, 92, 3, '#D488AC')], {
          names: ['board'],
          hidden: true,
          origin: [40, 56],
        }),
      ],
      {},
    ),
  ],
  {},
);

// ---- animations (ported from renderer/css/keyframes.css) -------------------

const breathe = anim(2.4, 'ease-in-out', [{ at: 0, sy: 1 }, { at: 0.5, sy: 1.03 }, { at: 1, sy: 1 }]);
const swayL = (d: number) => anim(d, 'ease-in-out', [{ at: 0, rot: 0 }, { at: 0.5, rot: -6 }, { at: 1, rot: 0 }]);
const swayR = (d: number) => anim(d, 'ease-in-out', [{ at: 0, rot: 0 }, { at: 0.5, rot: 6 }, { at: 1, rot: 0 }]);
const flapL = (d: number, e: Anim['ease'] = 'ease-in-out') =>
  anim(d, e, [{ at: 0, rot: 0 }, { at: 0.5, rot: -16 }, { at: 1, rot: 0 }]);
const flapR = (d: number, e: Anim['ease'] = 'ease-in-out') =>
  anim(d, e, [{ at: 0, rot: 0 }, { at: 0.5, rot: 16 }, { at: 1, rot: 0 }]);
const bounce = (a: number, b: number) => [{ at: 0, ty: a }, { at: 0.5, ty: b }, { at: 1, ty: a }];
const climbGrab = anim(0.3, 'ease-in-out', bounce(0, -4));
const floatUp = (delay?: number) =>
  anim(1.2, 'ease-out', [{ at: 0, ty: 4, opacity: 0 }, { at: 0.3, opacity: 1 }, { at: 1, ty: -8, opacity: 0 }], { delay });
const danglePair = (delay?: number) =>
  anim(0.6, 'ease-in-out', [{ at: 0, ty: 2, rot: 2 }, { at: 0.5, ty: 3, rot: -2 }, { at: 1, ty: 2, rot: 2 }], { delay });

const arms = (l: Anim, r: Anim): Pose['anim'] => ({ 'arm-l': l, 'arm-r': r });

const poses: Record<string, Pose> = {
  walk: {
    anim: {
      bob: anim(0.24, 'steps', bounce(0, -2)),
      'leg-a': anim(0.24, 'steps', bounce(-3, 0)),
      'leg-b': anim(0.24, 'steps', bounce(0, -3)),
      ...arms(flapL(0.24, 'steps'), flapR(0.24, 'steps')),
    },
  },
  idle: { anim: { bob: breathe, ...arms(swayL(2.4), swayR(2.4)) } },
  surf: {
    show: ['board'],
    anim: {
      board: anim(0.6, 'ease-in-out', [{ at: 0, rot: -2, ty: 0 }, { at: 0.5, rot: 2, ty: -2 }, { at: 1, rot: -2, ty: 0 }]),
      bob: anim(0.6, 'ease-in-out', [{ at: 0, rot: -1, ty: 0 }, { at: 0.5, rot: 1, ty: -3 }, { at: 1, rot: -1, ty: 0 }]),
      ...arms(swayL(0.6), swayR(0.6)),
    },
  },
  climb: {
    anim: {
      bob: anim(0.6, 'ease-in-out', [{ at: 0, rot: 2 }, { at: 0.5, rot: -2 }, { at: 1, rot: 2 }]),
      'leg-a': climbGrab,
      'arm-r': climbGrab,
      'leg-b': anim(0.3, 'ease-in-out', bounce(0, -4), { delay: 0.15 }),
      'arm-l': anim(0.3, 'ease-in-out', bounce(0, -4), { delay: 0.15 }),
    },
  },
  'climb.hang': {
    stop: ['leg', 'arm'],
    anim: {
      bob: breathe,
      eye: anim(3, 'ease-in-out', [{ at: 0, tx: 0 }, { at: 0.3, tx: -2 }, { at: 0.7, tx: 2 }, { at: 1, tx: 0 }]),
    },
  },
  code: {
    show: ['laptop'],
    set: { leg: { sy: 0.5 } },
    anim: {
      bob: anim(2.4, 'ease-in-out', [{ at: 0, ty: 6, sy: 1 }, { at: 0.5, ty: 6, sy: 1.02 }, { at: 1, ty: 6, sy: 1 }]),
      'arm-l': anim(0.24, 'steps', [{ at: 0, tx: 68, ty: 18 }, { at: 0.5, tx: 68, ty: 21 }, { at: 1, tx: 68, ty: 18 }]),
      'arm-r': anim(0.24, 'steps', [{ at: 0, tx: 8, ty: 21 }, { at: 0.5, tx: 8, ty: 18 }, { at: 1, tx: 8, ty: 21 }]),
    },
  },
  'code.closing': {
    stop: ['arm'],
    anim: { laptop: anim(0.3, 'ease-in-out', [{ at: 0, sy: 1 }, { at: 1, sy: 0.08 }], { once: true }) },
  },
  music: {
    show: ['headphones', 'dj-table', 'notes'],
    anim: {
      bob: anim(0.5, 'ease-in-out', [{ at: 0, ty: 0, rot: -1.5 }, { at: 0.5, ty: -2, rot: 1.5 }, { at: 1, ty: 0, rot: -1.5 }]),
      ...arms(flapL(0.5), flapR(0.5)),
      'note-1': anim(1.6, 'ease-out', [{ at: 0, ty: 6, opacity: 0 }, { at: 0.3, opacity: 1 }, { at: 1, ty: -8, opacity: 0 }]),
    },
  },
  soccer: {
    show: ['ball'],
    origin: { bob: [40, 55] },
    set: { 'leg-1': { tx: -3 }, 'leg-2': { tx: -1.5 }, 'leg-3': { tx: 1.5 }, 'leg-4': { tx: 3 } },
    anim: {
      ball: anim(2.4, 'ease-in-out', [
        { at: 0, tx: 0, ty: 0 },
        { at: 0.25, tx: -35, ty: -30 },
        { at: 0.5, tx: -71, ty: 0 },
        { at: 0.75, tx: -35, ty: -30 },
        { at: 1, tx: 0, ty: 0 },
      ]),
      bob: anim(2.4, 'ease-in-out', [
        { at: 0, rot: -6, ty: 0 },
        { at: 0.25, rot: 0, ty: -3 },
        { at: 0.5, rot: 6, ty: 0 },
        { at: 0.75, rot: 0, ty: -3 },
        { at: 1, rot: -6, ty: 0 },
      ]),
      ...arms(swayL(0.55), swayR(0.55)),
    },
  },
  coffee: {
    show: ['cup'],
    set: { 'arm-r': { rot: -30 } },
    anim: {
      cup: anim(0.35, 'ease-out', [{ at: 0, tx: 0, ty: 14 }, { at: 1, tx: -2, ty: -8 }], { once: true }),
      steam: anim(1.4, 'ease-in-out', bounce(0, -2.5)),
      bob: breathe,
      'arm-l': swayL(1.8),
    },
  },
  'coffee.sipping': {
    show: ['eyes-h'],
    hide: ['eyes-n'],
    anim: { cup: anim(0.3, 'ease-in-out', [{ at: 0, tx: -2, ty: -8 }, { at: 1, tx: -2, ty: -11 }], { alternate: true }) },
  },
  jump: {
    anim: {
      bob: anim(0.45, 'ease-in-out', [
        { at: 0, ty: 0, sy: 0.94 },
        { at: 0.4, ty: -14, sy: 1.05 },
        { at: 0.6, ty: -14, sy: 1.05 },
        { at: 1, ty: 0, sy: 0.94 },
      ]),
      leg: anim(0.45, 'ease-in-out', [{ at: 0, ty: 0 }, { at: 0.4, ty: -4 }, { at: 0.6, ty: -4 }, { at: 1, ty: 0 }]),
      ...arms(flapL(0.45), flapR(0.45)),
    },
  },
  held: {
    set: { eye: { sy: 1.25 } },
    anim: {
      bob: anim(0.9, 'ease-in-out', [{ at: 0, rot: 4 }, { at: 0.5, rot: -4 }, { at: 1, rot: 4 }]),
      ...arms(swayL(0.9), swayR(0.9)),
      'leg-a': danglePair(),
      'leg-b': danglePair(0.3),
    },
  },
  fall: {
    set: { eye: { sy: 1.25 }, leg: { ty: -3 } },
    anim: {
      'arm-l': anim(0.15, 'ease-in-out', [{ at: 0, ty: -2 }, { at: 1, ty: 2 }], { alternate: true }),
      'arm-r': anim(0.15, 'ease-in-out', [{ at: 0, ty: -2 }, { at: 1, ty: 2 }], { alternate: true }),
    },
  },
  'fall.chute': {
    show: ['parachute'],
    stop: ['arm'],
    anim: { parachute: anim(1.2, 'ease-in-out', [{ at: 0, rot: -3 }, { at: 0.5, rot: 3 }, { at: 1, rot: -3 }]) },
  },
  'fall.scared': { hide: ['eyes-n'], show: ['eyes-x'] },
  pat: {
    show: ['eyes-h', 'hearts'],
    hide: ['eyes-n'],
    anim: {
      bob: anim(0.6, 'ease-in-out', [{ at: 0, sy: 1, ty: 0 }, { at: 0.5, sy: 1.06, ty: -1 }, { at: 1, sy: 1, ty: 0 }]),
      ...arms(flapL(0.6), flapR(0.6)),
      'heart-1': floatUp(),
      'heart-2': floatUp(0.6),
    },
  },
  think: {
    show: ['think-bubble'],
    set: { 'think-bubble': { ty: -6 } },
    anim: {
      'think-bubble': anim(2, 'ease-in-out', [{ at: 0, sx: 1.25, sy: 1.25 }, { at: 0.5, sx: 1.35, sy: 1.35 }, { at: 1, sx: 1.25, sy: 1.25 }]),
      bob: breathe,
      ...arms(swayL(1.8), swayR(1.8)),
    },
  },
  'think.care-msg': { hide: ['think-bubble'] },
};

export const clawd: SpriteConfig = {
  id: 'clawd',
  label: 'Clawd',
  flipAxisX: 40,
  faces: 1,
  body: { left: 10, right: 70, footY: 55 },
  hitbox: { x: -7, y: 0, w: 94, h: 56 },
  headZone: { x: 10, y: 0, w: 60, h: 20 },
  tricks: ['code', 'jump', 'music', 'soccer', 'climb', 'surf', 'think', 'coffee'],
  root,
  poses,
};
