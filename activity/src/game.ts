import { SpriteRenderer } from './engine/renderer';
import type { Box, SpriteConfig } from './engine/types';
import { layoutYard, newWorld, WORLD_WIDTH } from './engine/yard-layout';
import { LocalSource } from './source/local';
import { NetSource } from './source/net';
import type { PetSource } from './source/types';
import { SPRITES } from './sprites';
import { SPRITE_META } from './sprites/meta';
import { Bubble } from './ui/bubble';
import { Hud } from './ui/hud';
import { drawFood, drawYard } from './yard/yard';

const MAX_FRAME_MS = 250;
const CLICK_SLOP = 4;
const HEAD_GAP = 2;
const GREETING_MS = 6000;

const inside = (b: Box, px: number, py: number) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;

interface Greeting {
  text: string;
  avatarUrl: string | null;
  until: number;
}

export class Game {
  private readonly yard = newWorld(600);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bubble: Bubble;
  private readonly hud: Hud;
  private renderer: SpriteRenderer;
  private local: LocalSource;
  private net: NetSource | null = null;
  private scale = 1;
  private last = 0;
  private downAt: { x: number; y: number; head: boolean } | null = null;
  private hovering = false;
  private greeting: Greeting | null = null;
  private bubbleKey = '';
  private lastSource: PetSource | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private stage: HTMLElement,
    bubbleEl: HTMLElement,
    private sprite: SpriteConfig,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new SpriteRenderer(sprite);
    this.local = new LocalSource(this.yard, SPRITE_META[sprite.id]);
    this.bubble = new Bubble(bubbleEl);
    this.hud = new Hud({ onFeed: () => this.source.feed(), onPat: () => this.source.pat() });
  }

  /** The shared (server) pet when connected, otherwise a local one so the pet never disappears. */
  private get source(): PetSource {
    return this.net?.ready ? this.net : this.local;
  }

  start(): void {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();
    requestAnimationFrame((t) => {
      this.last = t;
      this.frame(t);
    });
  }

  /** Greets this viewer only; it never touches the shared pet. */
  greet(text: string, avatarUrl: string | null = null): void {
    this.greeting = { text, avatarUrl, until: performance.now() + GREETING_MS };
  }

  connectRoom(room: string, name: string): void {
    this.net?.close();
    this.net = new NetSource({
      room,
      name,
      model: this.sprite.id,
      yard: this.yard,
      body: () => this.sprite.body,
      onEvent: (kind, by) => this.hud.toast(kind === 'feed' ? `${by} đã cho ăn` : `${by} đang vuốt ve`),
      onPresence: (names) => this.hud.setPresence(names),
      onModel: (id) => this.setSprite(id),
    });
  }

  private setSprite(id: string): void {
    const next = SPRITES[id];
    if (!next || next.id === this.sprite.id) return;
    this.sprite = next;
    this.renderer = new SpriteRenderer(next);
    this.local = new LocalSource(this.yard, SPRITE_META[next.id]);
  }

  // The world is always WORLD_WIDTH wide so every client and the server agree on geometry;
  // only the sky height follows the frame. `scale` is CSS px per world unit.
  private resize(): void {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    this.scale = cssW / WORLD_WIDTH;
    layoutYard(this.yard, cssH / this.scale);
    this.source.relayout();
    this.local.relayout();

    for (const el of [this.stage, this.canvas]) {
      el.style.width = `${cssW}px`;
      el.style.height = `${cssH}px`;
    }
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(this.canvas.width / this.yard.width, 0, 0, this.canvas.height / this.yard.height, 0, 0);
  }

  private toYard(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.yard.width, y: ((e.clientY - r.top) / r.height) * this.yard.height };
  }

  private bindPointer(): void {
    const c = this.canvas;
    const local = (p: { x: number; y: number }) => {
      const v = this.source.view();
      return { x: p.x - v.x, y: p.y - v.y };
    };

    c.addEventListener('pointermove', (e) => {
      const p = this.toYard(e);
      const src = this.source;
      src.cursor(p.x, p.y);
      if (this.downAt) {
        src.dragTo(p.x, p.y);
        return;
      }
      const l = local(p);
      const onHead = inside(this.sprite.headZone, l.x, l.y);
      if (onHead !== this.hovering) {
        this.hovering = onHead;
        src.hover(onHead);
      }
      c.style.cursor = inside(this.sprite.hitbox, l.x, l.y) ? 'grab' : 'default';
    });

    c.addEventListener('pointerdown', (e) => {
      const p = this.toYard(e);
      const l = local(p);
      if (!inside(this.sprite.hitbox, l.x, l.y)) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      this.downAt = { x: p.x, y: p.y, head: inside(this.sprite.headZone, l.x, l.y) };
      this.source.startDrag(p.x, p.y);
      c.style.cursor = 'grabbing';
    });

    const release = (e: PointerEvent) => {
      if (!this.downAt) return;
      const p = this.toYard(e);
      const click = Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) < CLICK_SLOP;
      const src = this.source;
      // A tap on the head is a pat (touch screens have no hover); a tap elsewhere shouldn't drop the pet.
      src.endDrag(!click);
      if (click && this.downAt.head) src.pat();
      this.downAt = null;
      c.style.cursor = 'grab';
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('pointerleave', () => {
      if (!this.downAt && this.hovering) {
        this.hovering = false;
        this.source.hover(false);
      }
    });
  }

  private syncBubble(careText: string | null, nowMs: number): void {
    if (this.greeting && nowMs > this.greeting.until) this.greeting = null;
    const g = careText ? null : this.greeting;
    const key = careText ? `c:${careText}` : g ? `g:${g.text}` : '';
    if (key === this.bubbleKey) return;
    this.bubbleKey = key;
    if (careText) this.bubble.show(careText);
    else if (g) this.bubble.show(g.text, g.avatarUrl);
    else this.bubble.hide();
  }

  private frame(t: number): void {
    const dt = Math.min(t - this.last, MAX_FRAME_MS);
    this.last = t;
    const now = t / 1000;

    const src = this.source;
    if (src !== this.lastSource) {
      // Switching between the local and shared pet mid-gesture would leave a drag dangling.
      this.downAt = null;
      this.hovering = false;
      this.lastSource = src;
    }
    src.update(dt);
    const v = src.view();

    const { ctx } = this;
    drawYard(ctx, this.yard, now);
    this.renderer.setTags(v.tags, now);
    this.renderer.draw(ctx, Math.round(v.x), Math.round(v.y), v.facing, now);
    if (v.food) drawFood(ctx, v.food, this.yard.groundY);

    this.syncBubble(v.careText, t);
    if (this.bubble.visible) {
      const cx = (v.x + this.sprite.flipAxisX) * this.scale;
      this.bubble.place(cx, v.y * this.scale - HEAD_GAP, this.stage.clientWidth);
    }

    requestAnimationFrame((n) => this.frame(n));
  }
}
