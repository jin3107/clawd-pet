import { CARE_MESSAGES, careIntervalMs } from './data/care';
import { PetBrain } from './engine/brain';
import { SpriteRenderer } from './engine/renderer';
import type { Box, SpriteConfig } from './engine/types';
import { Bubble } from './ui/bubble';
import { drawYard, layoutYard, YARD } from './yard/yard';

const ZOOM = Number(new URLSearchParams(location.search).get('zoom'));
const PET_ZOOM = ZOOM >= 0.25 && ZOOM <= 4 ? ZOOM : 1;
const MAX_FRAME_MS = 250;
const CLICK_SLOP = 4;
const HEAD_GAP = 2;

const inside = (b: Box, px: number, py: number) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;

export class Game {
  readonly brain: PetBrain;
  private readonly renderer: SpriteRenderer;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bubble: Bubble;
  private scale = 1;
  private last = 0;
  private downAt: { x: number; y: number; head: boolean } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private stage: HTMLElement,
    bubbleEl: HTMLElement,
    private sprite: SpriteConfig,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.brain = new PetBrain({ yard: YARD, sprite });
    this.renderer = new SpriteRenderer(sprite);
    this.bubble = new Bubble(bubbleEl);
  }

  start(): void {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();
    this.scheduleCare();
    requestAnimationFrame((t) => {
      this.last = t;
      this.frame(t);
    });
  }

  /** Shows a bubble once the pet is free to take it (not mid-drag / fall / climb). */
  say(message: string, avatarUrl?: string | null): void {
    let tries = 0;
    const attempt = () => {
      if (this.brain.showCare(message)) this.bubble.show(message, avatarUrl);
      else if (++tries < 20) setTimeout(attempt, 1000);
    };
    attempt();
  }

  private scheduleCare(): void {
    const [min, max] = careIntervalMs();
    setTimeout(() => {
      this.say(CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)]);
      this.scheduleCare();
    }, min + Math.random() * (max - min));
  }

  // The yard fills the whole Activity frame; `scale` is CSS px per yard unit, so a smaller
  // value (?zoom=) makes the pet smaller relative to the frame.
  private resize(): void {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    this.scale = PET_ZOOM;
    layoutYard(cssW / this.scale, cssH / this.scale);
    this.brain.relayout();

    for (const el of [this.stage, this.canvas]) {
      el.style.width = `${cssW}px`;
      el.style.height = `${cssH}px`;
    }
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(this.canvas.width / YARD.width, 0, 0, this.canvas.height / YARD.height, 0, 0);
  }

  private toYard(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * YARD.width, y: ((e.clientY - r.top) / r.height) * YARD.height };
  }

  private bindPointer(): void {
    const c = this.canvas;
    const local = (p: { x: number; y: number }) => ({ x: p.x - this.brain.x, y: p.y - this.brain.y });

    c.addEventListener('pointermove', (e) => {
      const p = this.toYard(e);
      this.brain.noteCursor(p.x, p.y);
      const l = local(p);
      if (this.downAt) {
        this.brain.dragTo(p.x, p.y);
        return;
      }
      this.brain.setPatHover(inside(this.sprite.headZone, l.x, l.y));
      c.style.cursor = inside(this.sprite.hitbox, l.x, l.y) ? 'grab' : 'default';
    });

    c.addEventListener('pointerdown', (e) => {
      const p = this.toYard(e);
      const l = local(p);
      if (!inside(this.sprite.hitbox, l.x, l.y)) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.downAt = { x: p.x, y: p.y, head: inside(this.sprite.headZone, l.x, l.y) };
      this.brain.startDrag(p.x, p.y);
      this.bubble.hide();
      c.style.cursor = 'grabbing';
    });

    const release = (e: PointerEvent) => {
      if (!this.downAt) return;
      const p = this.toYard(e);
      const click = Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < CLICK_SLOP;
      // A tap on the head is a pat (touch screens have no hover); a tap elsewhere shouldn't drop the pet.
      this.brain.endDrag(!click);
      if (click && this.downAt.head) this.brain.patFor(1500);
      this.downAt = null;
      c.style.cursor = 'grab';
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('pointerleave', () => {
      if (!this.downAt) this.brain.setPatHover(false);
    });
  }

  private frame(t: number): void {
    const dt = Math.min(t - this.last, MAX_FRAME_MS);
    this.last = t;
    const now = t / 1000;

    this.brain.update(dt);
    if (this.bubble.visible && !this.brain.careActive) this.bubble.hide();

    const { ctx } = this;
    drawYard(ctx, YARD, now);
    this.renderer.setTags(this.brain.tags(), now);
    this.renderer.draw(ctx, Math.round(this.brain.x), Math.round(this.brain.y), this.brain.facing, now);

    if (this.bubble.visible) {
      const cx = (this.brain.x + this.sprite.flipAxisX) * this.scale;
      this.bubble.place(cx, this.brain.y * this.scale - HEAD_GAP, this.stage.clientWidth);
    }

    requestAnimationFrame((n) => this.frame(n));
  }
}
