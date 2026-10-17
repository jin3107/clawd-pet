import { xBounds } from '../engine/geometry';
import type { SpriteConfig, Yard } from '../engine/types';
import type { ClientMsg, ServerMsg, Snapshot } from '../shared/protocol';
import type { PetSource, PetView } from './types';

const SMOOTH_RATE = 18;
const SNAP_DIST_X = 150;
const SNAP_DIST_Y = 200;
const SEND_INTERVAL_MS = 33;
const CURSOR_INTERVAL_MS = 250;

export interface NetOptions {
  room: string;
  name: string;
  model: string;
  yard: Yard;
  body: () => SpriteConfig['body'];
  onEvent: (kind: 'feed' | 'pat', by: string) => void;
  onPresence: (names: string[]) => void;
  onModel: (model: string) => void;
}

export class NetSource implements PetSource {
  readonly kind = 'net' as const;
  private ws: WebSocket | null = null;
  private urlIdx = 0;
  private opened = false;
  private everOpened = false;
  private fails = 0;
  private closed = false;
  private snap: Snapshot | null = null;
  private foodShown: PetView['food'] = null;
  private shown = false;
  private x = 0;
  private ry = 0;
  private dragging = false;
  private dragOffX = 0;
  private dragOffRy = 0;
  private lastSend = 0;
  private lastCursor = 0;
  private cur: PetView = { x: 0, y: 0, facing: 1, tags: ['idle'], careText: null, food: null };

  constructor(private opts: NetOptions) {
    this.connect();
  }

  /** True once the server has sent the room's current state; Game only uses this source then. */
  get ready(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.snap !== null;
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
  }

  private urls(): string[] {
    const base = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
    // Inside Discord the same-origin path normally works; /.proxy/ is the explicit proxy form, kept as a fallback.
    return [`${base}/ws`, `${base}/.proxy/ws`];
  }

  private connect(): void {
    if (this.closed) return;
    const urls = this.urls();
    const ws = new WebSocket(urls[this.urlIdx % urls.length]);
    this.ws = ws;
    this.opened = false;

    ws.onopen = () => {
      this.opened = true;
      this.everOpened = true;
      this.fails = 0;
      this.send({ t: 'join', room: this.opts.room, name: this.opts.name, model: this.opts.model });
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        /* ignore malformed frame */
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.snap = null;
      this.shown = false;
      this.dragging = false;
      this.opts.onPresence([]);
      if (this.closed) return;
      // Only hunt for a working URL until one has connected; afterwards a failure just means the server is down.
      if (!this.opened && !this.everOpened) this.urlIdx++;
      this.fails++;
      setTimeout(() => this.connect(), Math.min(1000 * 2 ** Math.min(this.fails, 4), 10_000));
    };
  }

  private onMessage(m: ServerMsg): void {
    switch (m.t) {
      case 'welcome':
        this.snap = m.snap;
        this.opts.onPresence(m.names);
        if (m.model !== this.opts.model) this.opts.onModel(m.model);
        break;
      case 'snap':
        this.snap = m.s;
        break;
      case 'presence':
        this.opts.onPresence(m.names);
        break;
      case 'event':
        this.opts.onEvent(m.kind, m.by);
        break;
      case 'drag-denied':
        this.dragging = false;
        break;
    }
  }

  private send(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private throttled(): boolean {
    const now = performance.now();
    if (now - this.lastSend < SEND_INTERVAL_MS) return true;
    this.lastSend = now;
    return false;
  }

  update(dtMs: number): void {
    const s = this.snap;
    if (!s) return;
    const gy = this.opts.yard.groundY;

    if (!this.shown) {
      this.x = s.x;
      this.ry = s.ry;
      this.shown = true;
    } else if (!this.dragging) {
      const k = 1 - Math.exp((-dtMs / 1000) * SMOOTH_RATE);
      this.x = Math.abs(s.x - this.x) > SNAP_DIST_X ? s.x : this.x + (s.x - this.x) * k;
      this.ry = Math.abs(s.ry - this.ry) > SNAP_DIST_Y ? s.ry : this.ry + (s.ry - this.ry) * k;
    }

    // The cookie follows the pet's hand, so it gets the same smoothing or the two drift apart.
    let food: PetView['food'] = null;
    if (s.food) {
      const f = this.foodShown;
      const k = 1 - Math.exp((-dtMs / 1000) * SMOOTH_RATE);
      this.foodShown =
        f && Math.abs(s.food.x - f.x) < SNAP_DIST_X
          ? { x: f.x + (s.food.x - f.x) * k, ry: f.ry + (s.food.ry - f.ry) * k, s: f.s + (s.food.s - f.s) * k }
          : { ...s.food };
      food = this.foodShown;
    } else {
      this.foodShown = null;
    }

    this.cur = { x: this.x, y: gy + this.ry, facing: s.facing, tags: s.tags, careText: s.care, food };
  }

  view(): PetView {
    return this.cur;
  }

  relayout(): void {
    /* positions are ground-relative, nothing to fix */
  }

  // While I hold the pet I render it under my own cursor instead of waiting a round trip for the snapshot.
  startDrag(px: number, py: number): void {
    const ry = py - this.opts.yard.groundY;
    this.dragging = true;
    this.dragOffX = px - this.x;
    this.dragOffRy = ry - this.ry;
    this.send({ t: 'dragStart', x: px, ry });
  }

  dragTo(px: number, py: number): void {
    if (!this.dragging) return;
    const yard = this.opts.yard;
    const body = this.opts.body();
    const [min, max] = xBounds(yard, body);
    const ry = py - yard.groundY;
    this.x = Math.min(Math.max(px - this.dragOffX, min), max);
    this.ry = Math.min(ry - this.dragOffRy, -body.footY);
    if (!this.throttled()) this.send({ t: 'drag', x: px, ry });
  }

  endDrag(fall: boolean): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.send({ t: 'dragEnd', fall });
  }

  hover(on: boolean): void {
    this.send({ t: 'hover', on });
  }

  cursor(px: number, py: number): void {
    const now = performance.now();
    if (now - this.lastCursor < CURSOR_INTERVAL_MS) return;
    this.lastCursor = now;
    this.send({ t: 'cursor', x: px, ry: py - this.opts.yard.groundY });
  }

  pat(): void {
    this.send({ t: 'pat' });
  }

  feed(): void {
    this.send({ t: 'feed' });
  }
}
