import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { CARE_MESSAGES } from '../src/data/messages';
import { PetBrain } from '../src/engine/brain';
import { newWorld } from '../src/engine/yard-layout';
import type { ClientMsg, ServerMsg, Snapshot } from '../src/shared/protocol';
import { DEFAULT_MODEL, SPRITE_META } from '../src/sprites/meta';

const TICK_MS = 30;
const SNAP_MS = 66;
const MAX_MSGS_PER_SEC = 120;
const EMPTY_ROOM_TTL_MS = 60_000;
const PAT_MS = 2000;

const careRangeMs = (): [number, number] => {
  const min = (Number(process.env.CARE_MIN_MIN) || 60) * 60_000;
  const max = Math.max(min, (Number(process.env.CARE_MAX_MIN) || 75) * 60_000);
  return [min, max];
};

interface Client {
  id: string;
  name: string;
  ws: WebSocket;
  hovering: boolean;
  windowStart: number;
  windowCount: number;
}

const num = (v: unknown, lim = 100_000): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : null;

export class Room {
  private readonly yard = newWorld(600);
  private readonly brain: PetBrain;
  private readonly clients = new Map<WebSocket, Client>();
  private holder: Client | null = null;
  private careText: string | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private careTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTick = 0;
  private snapAcc = 0;
  private lastJson = '';
  emptySince: number | null = Date.now();

  constructor(readonly key: string, readonly model: string) {
    const meta = SPRITE_META[model] ?? SPRITE_META[DEFAULT_MODEL];
    this.brain = new PetBrain({ yard: this.yard, sprite: meta });
  }

  get size(): number {
    return this.clients.size;
  }

  private names(): string[] {
    return [...this.clients.values()].map((c) => c.name);
  }

  private send(ws: WebSocket, msg: ServerMsg): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMsg): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients.keys()) if (ws.readyState === ws.OPEN) ws.send(data);
  }

  private snapshot(): Snapshot {
    const b = this.brain;
    return {
      x: Math.round(b.x * 10) / 10,
      ry: Math.round((b.y - this.yard.groundY) * 10) / 10,
      facing: b.facing,
      tags: b.tags(),
      care: this.careText,
      food: b.food ? { x: Math.round(b.food.x * 10) / 10, ry: Math.round(b.food.ry * 10) / 10, s: Math.round(b.food.s * 20) / 20 } : null,
    };
  }

  add(ws: WebSocket, name: string): Client {
    const client: Client = { id: randomUUID(), name, ws, hovering: false, windowStart: Date.now(), windowCount: 0 };
    this.clients.set(ws, client);
    this.emptySince = null;
    if (this.clients.size === 1) this.start();
    this.send(ws, { t: 'welcome', id: client.id, model: this.model, snap: this.snapshot(), names: this.names() });
    this.broadcast({ t: 'presence', names: this.names() });
    return client;
  }

  remove(client: Client): void {
    if (!this.clients.delete(client.ws)) return;
    if (this.holder === client) {
      this.holder = null;
      this.brain.endDrag(true);
    }
    this.syncHover();
    if (this.clients.size === 0) {
      this.stop();
      this.emptySince = Date.now();
    } else {
      this.broadcast({ t: 'presence', names: this.names() });
    }
  }

  private syncHover(): void {
    this.brain.setPatHover([...this.clients.values()].some((c) => c.hovering));
  }

  handle(client: Client, msg: ClientMsg): void {
    const now = Date.now();
    if (now - client.windowStart > 1000) {
      client.windowStart = now;
      client.windowCount = 0;
    }
    if (++client.windowCount > MAX_MSGS_PER_SEC) return;

    const gy = this.yard.groundY;
    switch (msg.t) {
      case 'cursor': {
        const x = num(msg.x);
        const ry = num(msg.ry);
        if (x !== null && ry !== null) this.brain.noteCursor(x, gy + ry);
        break;
      }
      case 'hover':
        client.hovering = msg.on === true;
        this.syncHover();
        break;
      case 'dragStart': {
        const x = num(msg.x);
        const ry = num(msg.ry);
        if (x === null || ry === null) break;
        if (this.holder && this.holder !== client) {
          this.send(client.ws, { t: 'drag-denied' });
          break;
        }
        this.holder = client;
        this.brain.startDrag(x, gy + ry);
        break;
      }
      case 'drag': {
        const x = num(msg.x);
        const ry = num(msg.ry);
        if (this.holder === client && x !== null && ry !== null) this.brain.dragTo(x, gy + ry);
        break;
      }
      case 'dragEnd':
        if (this.holder === client) {
          this.holder = null;
          this.brain.endDrag(msg.fall !== false);
          this.syncHover();
        }
        break;
      case 'pat':
        this.brain.patFor(PAT_MS);
        this.broadcast({ t: 'event', kind: 'pat', by: client.name });
        break;
      case 'feed':
        if (this.brain.feed()) this.broadcast({ t: 'event', kind: 'feed', by: client.name });
        break;
    }
  }

  private start(): void {
    this.lastTick = Date.now();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    this.scheduleCare();
  }

  private stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.careTimer) clearTimeout(this.careTimer);
    this.tickTimer = this.careTimer = null;
  }

  dispose(): void {
    this.stop();
  }

  private tick(): void {
    const now = Date.now();
    const dt = Math.min(now - this.lastTick, 250);
    this.lastTick = now;
    this.brain.update(dt);
    if (this.careText && !this.brain.careActive) this.careText = null;

    this.snapAcc += dt;
    if (this.snapAcc < SNAP_MS) return;
    this.snapAcc = 0;
    const snap = this.snapshot();
    const json = JSON.stringify(snap);
    if (json === this.lastJson) return;
    this.lastJson = json;
    this.broadcast({ t: 'snap', s: snap });
  }

  private scheduleCare(): void {
    const [min, max] = careRangeMs();
    this.careTimer = setTimeout(() => {
      this.tryCare(CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)], 0);
      this.scheduleCare();
    }, min + Math.random() * (max - min));
  }

  private tryCare(text: string, attempt: number): void {
    if (this.clients.size === 0) return;
    if (this.brain.showCare(text)) this.careText = text;
    else if (attempt < 12) setTimeout(() => this.tryCare(text, attempt + 1), 5000);
  }
}

/** Parses an untrusted frame; returns null for anything that is not a well-formed ClientMsg. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null || typeof (m as { t?: unknown }).t !== 'string') return null;
  const t = (m as { t: string }).t;
  return ['join', 'cursor', 'hover', 'dragStart', 'drag', 'dragEnd', 'pat', 'feed', 'ping'].includes(t) ? (m as ClientMsg) : null;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, Room>();

  constructor() {
    setInterval(() => this.sweep(), 30_000).unref();
  }

  join(ws: WebSocket, msg: Extract<ClientMsg, { t: 'join' }>): { room: Room; client: Client } | null {
    const key = typeof msg.room === 'string' ? msg.room.slice(0, 128) : '';
    if (!key) return null;
    const name = (typeof msg.name === 'string' ? msg.name : '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32) || 'Khách';

    let room = this.rooms.get(key);
    if (!room) {
      const model = typeof msg.model === 'string' && SPRITE_META[msg.model] ? msg.model : DEFAULT_MODEL;
      room = new Room(key, model);
      this.rooms.set(key, room);
    }
    return { room, client: room.add(ws, name) };
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, room] of this.rooms) {
      if (room.size === 0 && room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
        room.dispose();
        this.rooms.delete(key);
      }
    }
  }
}
