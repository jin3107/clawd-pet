import type { Anim, Ease, Xform } from './types';

type Field = keyof Required<Xform>;
const DEFAULTS: Required<Xform> = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, opacity: 1 };
const FIELDS = Object.keys(DEFAULTS) as Field[];

type Track = Array<[at: number, value: number]>;
const trackCache = new WeakMap<Anim, Partial<Record<Field, Track>>>();

// Like CSS keyframes: a property only interpolates between the keyframes that mention it,
// falling back to its identity value at 0% / 100% when they don't.
function tracksFor(anim: Anim): Partial<Record<Field, Track>> {
  let tracks = trackCache.get(anim);
  if (tracks) return tracks;
  tracks = {};
  for (const f of FIELDS) {
    const pts: Track = anim.keys
      .filter((k) => k[f] !== undefined)
      .map((k): [number, number] => [k.at, k[f] as number])
      .sort((a, b) => a[0] - b[0]);
    if (pts.length === 0) continue;
    if (pts[0][0] > 0) pts.unshift([0, DEFAULTS[f]]);
    if (pts[pts.length - 1][0] < 1) pts.push([1, DEFAULTS[f]]);
    tracks[f] = pts;
  }
  trackCache.set(anim, tracks);
  return tracks;
}

function applyEase(kind: Ease, t: number): number {
  switch (kind) {
    case 'steps':
      return 0;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t * t * (3 - 2 * t);
    default:
      return t;
  }
}

/** Returns null while the animation is still in its delay (CSS shows the un-animated style then). */
export function sampleAnim(anim: Anim, elapsedSec: number): Required<Xform> | null {
  const t = elapsedSec - (anim.delay ?? 0);
  if (t < 0) return null;

  const cycles = t / anim.duration;
  let p: number;
  if (anim.once) {
    p = Math.min(cycles, 1);
  } else {
    const whole = Math.floor(cycles);
    p = cycles - whole;
    if (anim.alternate && whole % 2 === 1) p = 1 - p;
  }

  const out = { ...DEFAULTS };
  const tracks = tracksFor(anim);
  for (const f of FIELDS) {
    const pts = tracks[f];
    if (!pts) continue;
    if (p >= pts[pts.length - 1][0]) {
      out[f] = pts[pts.length - 1][1];
      continue;
    }
    let i = 0;
    while (i < pts.length - 2 && p >= pts[i + 1][0]) i++;
    const [a0, v0] = pts[i];
    const [a1, v1] = pts[i + 1];
    const local = applyEase(anim.ease, (p - a0) / (a1 - a0));
    out[f] = v0 + (v1 - v0) * local;
  }
  return out;
}
