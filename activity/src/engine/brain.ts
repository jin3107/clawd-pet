import { xBounds } from './geometry';
import type { SpriteConfig, Yard } from './types';

// Constants carried over from the Electron build's main.js so the pet moves identically.
const STEP_MS = 30;
const WALK_STEP = 3.2;
const SURF_SPEED = 4.5;
const CLIMB_SPEED = 1.2;
const CLIMB_H = 90;
const AFK_MS = 12000;
const GRAVITY = 0.9;
const CHUTE_GRAVITY = 0.15;
const CHUTE_MAX_VY = 1.6;

export type PetState =
  | 'idle' | 'walk' | 'surf' | 'climb' | 'code' | 'jump' | 'music' | 'soccer'
  | 'held' | 'fall' | 'pat' | 'think' | 'coffee' | 'butterfly' | 'eat';

const PATTABLE = new Set<PetState>(['idle', 'walk', 'code', 'jump', 'music', 'soccer', 'pat']);

export interface BrainOptions {
  yard: Yard;
  sprite: Pick<SpriteConfig, 'body' | 'tricks' | 'anchors'>;
  random?: () => number;
}

/** A cookie. `ry` is the y of its centre measured from the ground line; `s` is its size (1 = whole). */
export interface Food {
  x: number;
  ry: number;
  s: number;
}

const FOOD_SIZE = 14;
const FOOD_REST_RY = -FOOD_SIZE / 2;
const EAT_STAND_GAP = 40;
const PHASE_TICKS = { reach: 14, carry: 18, toss: 10, chew: 70 } as const;
type EatPhase = keyof typeof PHASE_TICKS;

/** Pure simulation: no DOM, no timers. Feed it time with update(dtMs). */
export class PetBrain {
  x: number;
  y: number;
  facing: 1 | -1 = 1;
  state: PetState = 'idle';
  careActive = false;
  food: Food | null = null;

  private readonly yard: Yard;
  private readonly body: SpriteConfig['body'];
  private readonly anchors: SpriteConfig['anchors'];
  private readonly tricks: string[];
  private readonly rand: () => number;

  private acc = 0;
  private simMs = 0;
  private tickN = 0;
  private frames = 60;
  private targetX = 0;
  private vy = 0;
  private climbPhase: 'up' | 'pause' | 'down' = 'up';
  private codePhase: 'typing' | 'closing' = 'typing';
  private coffeePhase: 'lift' | 'sip' = 'lift';
  private pendingClimb = false;
  private pendingEat = false;
  private foodLanded = false;
  private foodVy = 0;
  private eatPhase: EatPhase = 'reach';
  private phaseT = 0;
  private fallChute = false;
  private fallScared = false;

  private dragging = false;
  private dragOffX = 0;
  private dragOffY = 0;
  private patHover = false;
  private patUntil = 0;
  private lastCursor = { x: 0, y: 0 };
  private lastCursorMove = 0;

  constructor(opts: BrainOptions) {
    this.yard = opts.yard;
    this.body = opts.sprite.body;
    this.tricks = opts.sprite.tricks;
    this.anchors = opts.sprite.anchors;
    this.rand = opts.random ?? Math.random;
    this.x = (this.minX() + this.maxX()) / 2;
    this.y = this.groundTop(this.x);
    this.lastCursor = { x: this.x, y: this.y };
    this.startIdle();
  }

  // ---- geometry -----------------------------------------------------------

  private minX(): number {
    return xBounds(this.yard, this.body)[0];
  }

  private maxX(): number {
    return xBounds(this.yard, this.body)[1];
  }

  private clampX(x: number): number {
    return Math.min(Math.max(x, this.minX()), this.maxX());
  }

  /** Height of whatever the feet would stand on (ground or the tallest obstacle underfoot). */
  private groundTop(x: number): number {
    const x0 = x + this.body.left;
    const x1 = x + this.body.right;
    let h = 0;
    for (const o of this.yard.obstacles) {
      if (x1 > o.x && x0 < o.x + o.w) h = Math.max(h, o.h);
    }
    return this.yard.groundY - h - this.body.footY;
  }

  private pickTarget(minDist: number): number {
    const min = this.minX();
    const span = Math.max(0, this.maxX() - min);
    let t: number;
    let tries = 0;
    do {
      t = min + this.rand() * span;
    } while (Math.abs(t - this.x) < minDist && ++tries < 20);
    return t;
  }

  /** Call after the (shared, mutated) yard changed size so the pet stays inside it. */
  relayout(): void {
    this.x = this.clampX(this.x);
    this.targetX = this.clampX(this.targetX);
    if (this.state !== 'climb' && this.state !== 'fall' && !this.dragging) {
      this.y = this.groundTop(this.x);
    } else {
      this.y = Math.min(this.y, this.groundTop(this.x));
    }
  }

  // ---- public input -------------------------------------------------------

  noteCursor(px: number, py: number): void {
    if (Math.abs(px - this.lastCursor.x) > 2 || Math.abs(py - this.lastCursor.y) > 2) {
      this.lastCursor = { x: px, y: py };
      this.lastCursorMove = this.simMs;
    }
  }

  setPatHover(on: boolean): void {
    if (!this.dragging) this.patHover = on;
  }

  patFor(ms: number): void {
    this.patUntil = this.simMs + ms;
  }

  startDrag(px: number, py: number): void {
    this.dragging = true;
    this.patHover = false;
    this.patUntil = 0;
    this.pendingClimb = false;
    this.pendingEat = false;
    this.putFoodBack();
    this.dragOffX = px - this.x;
    this.dragOffY = py - this.y;
    this.careActive = false;
    this.state = 'held';
  }

  dragTo(px: number, py: number): void {
    if (!this.dragging) return;
    this.x = this.clampX(px - this.dragOffX);
    this.y = Math.min(py - this.dragOffY, this.groundTop(this.x));
  }

  /** `fall: false` is used for a plain click, which should not drop the pet. */
  endDrag(fall = true): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (!fall) {
      this.y = this.groundTop(this.x);
      this.startIdle();
      return;
    }
    this.vy = 0;
    this.state = 'fall';
    this.fallChute = this.rand() < 0.35;
    this.fallScared = this.rand() < 0.5;
  }

  /** Returns false (and does nothing) if the pet is busy being dragged, falling, climbing or eating. */
  showCare(message: string): boolean {
    if (this.dragging || this.state === 'fall' || this.state === 'climb' || this.state === 'eat') return false;
    this.state = 'think';
    this.pendingClimb = false;
    this.pendingEat = false;
    this.frames = Math.max(200, Math.min(360, message.length * 9));
    this.careActive = true;
    return true;
  }

  /** Drops a cookie somewhere away from the pet. Returns false if one is already lying around. */
  feed(): boolean {
    if (this.food) return false;
    const center = (this.body.left + this.body.right) / 2;
    const lo = this.minX() + center + 60;
    const hi = this.maxX() + center - 60;
    const clear = (fx: number) =>
      !this.yard.obstacles.some((o) => fx > o.x - 12 && fx < o.x + o.w + 12) && Math.abs(fx - (this.x + center)) > 120;
    let fx = lo + this.rand() * Math.max(0, hi - lo);
    for (let tries = 0; tries < 20 && !clear(fx); tries++) fx = lo + this.rand() * Math.max(0, hi - lo);
    this.food = { x: fx, ry: -160, s: 1 };
    this.foodLanded = false;
    this.foodVy = 0;
    return true;
  }

  /** If the pet lets go mid-meal (dragged away), the cookie drops back to the ground where it is. */
  private putFoodBack(): void {
    if (this.state !== 'eat' || !this.food) return;
    this.food.ry = FOOD_REST_RY;
    this.food.s = 1;
    this.foodLanded = true;
  }

  private stepFood(): void {
    const f = this.food;
    if (!f || this.foodLanded) return;
    this.foodVy += GRAVITY;
    f.ry += this.foodVy;
    if (f.ry >= FOOD_REST_RY) {
      f.ry = FOOD_REST_RY;
      this.foodLanded = true;
      if (this.state === 'idle') this.frames = 0;
    }
  }

  /** A sprite-space point in world coordinates for the current position and facing (mirrors about the body centre). */
  private worldPoint([sx, sy]: [number, number]): { x: number; ry: number } {
    const center = (this.body.left + this.body.right) / 2;
    const px = this.facing === 1 ? sx : 2 * center - sx;
    return { x: this.x + px, ry: this.y + sy - this.yard.groundY };
  }

  private setPhase(phase: EatPhase): void {
    this.eatPhase = phase;
    this.phaseT = 0;
  }

  private stepEat(): void {
    const f = this.food;
    this.phaseT++;
    const p = Math.min(1, this.phaseT / PHASE_TICKS[this.eatPhase]);
    const a = this.anchors;
    const lerp = (u: number, v: number, k: number) => u + (v - u) * k;
    const ease = (k: number) => k * k * (3 - 2 * k);

    switch (this.eatPhase) {
      case 'reach':
        if (p >= 1) this.setPhase('carry');
        break;
      case 'carry': {
        if (f) {
          const d = this.worldPoint(a.handDown);
          const u = this.worldPoint(a.handUp);
          f.x = lerp(d.x, u.x, ease(p));
          f.ry = lerp(d.ry, u.ry, ease(p));
        }
        if (p >= 1) this.setPhase('toss');
        break;
      }
      case 'toss': {
        if (f) {
          const u = this.worldPoint(a.handUp);
          const m = this.worldPoint(a.mouth);
          f.x = lerp(u.x, m.x, p);
          f.ry = lerp(u.ry, m.ry, p) - 16 * Math.sin(Math.PI * p);
          f.s = 1 - 0.6 * p;
        }
        if (p >= 1) {
          this.food = null;
          this.setPhase('chew');
        }
        break;
      }
      case 'chew':
        if (p >= 1) this.startIdle();
        break;
    }
  }

  /** Class-list equivalent of the Electron renderer's body classes; drives sprite poses. */
  tags(): string[] {
    const t: string[] = [this.state];
    if (this.state === 'eat') t.push(this.eatPhase);
    if (this.state === 'climb' && this.climbPhase === 'pause') t.push('hang');
    if (this.state === 'code' && this.codePhase === 'closing') t.push('closing');
    if (this.state === 'coffee' && this.coffeePhase === 'sip') t.push('sipping');
    if (this.state === 'fall') {
      if (this.fallChute) t.push('chute');
      if (this.fallScared) t.push('scared');
    }
    if (this.careActive) t.push('care-msg');
    return t;
  }

  // ---- simulation ---------------------------------------------------------

  update(dtMs: number): void {
    this.acc += dtMs;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
  }

  private startIdle(): void {
    this.state = 'idle';
    this.frames = 60 + this.rand() * 180;
    this.pendingClimb = false;
    this.pendingEat = false;
  }

  private goEat(food: { x: number }): void {
    const center = (this.body.left + this.body.right) / 2;
    const dir = food.x >= this.x + center ? 1 : -1;
    this.targetX = this.clampX(food.x - center - dir * EAT_STAND_GAP);
    this.facing = dir;
    this.pendingEat = true;
    this.state = 'walk';
  }

  private beginEat(): void {
    if (!this.food) return this.startIdle();
    const center = (this.body.left + this.body.right) / 2;
    this.facing = this.food.x >= this.x + center ? 1 : -1;
    this.state = 'eat';
    this.setPhase('reach');
  }

  private beginClimb(): void {
    this.state = 'climb';
    this.climbPhase = 'up';
  }

  private nextAction(): void {
    if (this.food && this.foodLanded) {
      this.goEat(this.food);
      return;
    }
    if (this.simMs - this.lastCursorMove > AFK_MS) {
      if (this.rand() < 0.25) {
        this.state = 'jump';
        this.frames = 40;
      } else {
        this.state = 'walk';
        this.targetX = this.clampX(this.lastCursor.x - 50 + (this.rand() * 160 - 80));
      }
      return;
    }

    if (this.rand() < 0.45) {
      this.state = 'walk';
      this.targetX = this.pickTarget(40);
      return;
    }

    const trick = this.tricks[Math.floor(this.rand() * this.tricks.length)];
    switch (trick) {
      case 'code':
        this.state = 'code';
        this.codePhase = 'typing';
        this.frames = 250 + this.rand() * 250;
        break;
      case 'coffee':
        this.state = 'coffee';
        this.coffeePhase = 'lift';
        this.frames = 15;
        break;
      case 'think':
        this.state = 'think';
        this.frames = 180 + this.rand() * 200;
        break;
      case 'jump':
        this.state = 'jump';
        this.frames = 45;
        break;
      case 'music':
        this.state = 'music';
        this.frames = 300 + this.rand() * 200;
        break;
      case 'soccer':
        this.state = 'soccer';
        this.frames = 260 + this.rand() * 150;
        break;
      case 'butterfly':
        this.state = 'butterfly';
        this.frames = 200 + this.rand() * 150;
        break;
      case 'surf':
        this.state = 'surf';
        this.targetX = this.pickTarget(300);
        break;
      case 'climb': {
        // Unlike the desktop build, climbing needs something to climb: walk to the nearer fence first.
        const left = this.x - this.minX() <= this.maxX() - this.x;
        this.targetX = left ? this.minX() : this.maxX();
        this.pendingClimb = true;
        this.state = 'walk';
        break;
      }
    }
  }

  private step(): void {
    this.tickN++;
    this.simMs += STEP_MS;
    this.stepFood();

    if (this.dragging) {
      this.state = 'held';
    } else if (this.state === 'fall') {
      if (this.fallChute) {
        this.vy = Math.min(this.vy + CHUTE_GRAVITY, CHUTE_MAX_VY);
      } else {
        this.vy += GRAVITY;
      }
      this.y += this.vy;
      this.x = this.clampX(this.x);
      const by = this.groundTop(this.x);
      if (this.y >= by) {
        this.y = by;
        if (this.vy > 5) this.vy = -this.vy * 0.35;
        else this.startIdle();
      }
    } else if ((this.patHover || this.simMs < this.patUntil) && PATTABLE.has(this.state)) {
      this.state = 'pat';
      this.y = this.groundTop(this.x);
    } else if (this.state === 'pat') {
      this.startIdle();
    } else if (this.state === 'walk' || this.state === 'surf') {
      this.stepMove();
    } else if (this.state === 'climb') {
      this.stepClimb();
    } else {
      this.y = this.groundTop(this.x);
      if (this.state === 'eat') this.stepEat();
      else if (--this.frames <= 0) this.endPhase();
    }

    if (this.careActive && this.state !== 'think') this.careActive = false;
  }

  private stepMove(): void {
    const dx = this.targetX - this.x;
    if (this.state === 'walk') {
      if (Math.abs(dx) < 4) {
        if (this.pendingEat) {
          this.pendingEat = false;
          this.beginEat();
        } else if (this.pendingClimb) {
          this.pendingClimb = false;
          this.facing = this.targetX > (this.minX() + this.maxX()) / 2 ? 1 : -1;
          this.beginClimb();
        } else {
          this.startIdle();
        }
      } else if (this.tickN % 2 === 0) {
        this.facing = dx > 0 ? 1 : -1;
        this.x += this.facing * WALK_STEP;
      }
    } else if (Math.abs(dx) < SURF_SPEED + 1) {
      this.startIdle();
    } else {
      this.facing = dx > 0 ? 1 : -1;
      this.x += this.facing * SURF_SPEED;
    }
    this.x = this.clampX(this.x);
    if (this.state !== 'climb') this.y = this.groundTop(this.x);
  }

  private stepClimb(): void {
    const base = this.groundTop(this.x);
    const top = base - CLIMB_H;
    if (this.climbPhase === 'up') {
      this.y -= CLIMB_SPEED;
      if (this.y <= top) {
        this.y = top;
        this.climbPhase = 'pause';
        this.frames = 80 + this.rand() * 120;
      }
    } else if (this.climbPhase === 'pause') {
      if (--this.frames <= 0) this.climbPhase = 'down';
    } else {
      this.y += CLIMB_SPEED * 1.6;
      if (this.y >= base) {
        this.y = base;
        this.startIdle();
      }
    }
  }

  private endPhase(): void {
    if (this.state === 'idle') {
      this.nextAction();
    } else if (this.state === 'code' && this.codePhase === 'typing') {
      this.codePhase = 'closing';
      this.frames = 12;
    } else if (this.state === 'coffee' && this.coffeePhase === 'lift') {
      this.coffeePhase = 'sip';
      this.frames = 200 + this.rand() * 150;
    } else {
      this.startIdle();
    }
  }
}
