import { sampleAnim } from './anim';
import type { Anim, SpriteConfig, SpriteNode, Xform } from './types';

interface NodeState {
  visible: boolean;
  anim: Anim | null;
  animStart: number;
  set: Xform | null;
  origin: readonly [number, number];
}

const BLINK: Anim = {
  duration: 0.25,
  ease: 'ease-in-out',
  once: true,
  keys: [{ at: 0, sy: 1 }, { at: 0.5, sy: 0.15 }, { at: 1, sy: 1 }],
};

const FLIP_SECONDS = 0.15;
const DEG = Math.PI / 180;

type Bounds = [number, number, number, number];

function bounds(node: SpriteNode): Bounds | null {
  if (node.kind !== 'group') return [node.x, node.y, node.x + node.w, node.y + node.h];
  let acc: Bounds | null = null;
  for (const c of node.children) {
    const b = bounds(c);
    if (!b) continue;
    acc = acc
      ? [Math.min(acc[0], b[0]), Math.min(acc[1], b[1]), Math.max(acc[2], b[2]), Math.max(acc[3], b[3])]
      : b;
  }
  return acc;
}

function baseOrigin(node: SpriteNode): readonly [number, number] {
  if (node.origin === 'center') {
    const b = bounds(node);
    return b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : [0, 0];
  }
  return node.origin ?? [0, 0];
}

export class SpriteRenderer {
  private states = new Map<SpriteNode, NodeState>();
  private poseKeys: Array<{ key: string; tags: string[] }>;
  private tagKey = '';
  private images = new Map<string, HTMLImageElement>();
  private visFacing = 1;
  private lastDraw = 0;
  private blinkStart = -1;
  private nextBlink = 0;

  constructor(private cfg: SpriteConfig) {
    this.register(cfg.root);
    // Cascade order: fewer tags first, so "fall.chute" overrides "fall"; ties keep declaration order.
    this.poseKeys = Object.keys(cfg.poses)
      .map((key) => ({ key, tags: key.split('.') }))
      .sort((a, b) => a.tags.length - b.tags.length);
  }

  private register(node: SpriteNode): void {
    this.states.set(node, { visible: !node.hidden, anim: null, animStart: 0, set: null, origin: baseOrigin(node) });
    if (node.kind === 'image' && !this.images.has(node.src)) {
      const img = new Image();
      img.src = node.src;
      this.images.set(node.src, img);
    }
    if (node.kind === 'group') node.children.forEach((c) => this.register(c));
  }

  /** Re-resolves poses only when the tag set changes; restarts an animation only if it changed. */
  setTags(tags: string[], now: number): void {
    const key = tags.join(' ');
    if (key === this.tagKey) return;
    this.tagKey = key;
    const active = new Set(tags);
    const matching = this.poseKeys.filter((p) => p.tags.every((t) => active.has(t)));

    for (const [node, st] of this.states) {
      const names = node.names ?? [];
      const has = (n: string) => names.includes(n);
      let visible = !node.hidden;
      let anim: Anim | null = null;
      let set: Xform | null = null;
      let origin = baseOrigin(node);

      for (const { key: k } of matching) {
        const pose = this.cfg.poses[k];
        if (pose.show?.some(has)) visible = true;
        if (pose.hide?.some(has)) visible = false;
        if (pose.stop?.some(has)) anim = null;
        for (const [n, a] of Object.entries(pose.anim ?? {})) if (has(n)) anim = a;
        for (const [n, x] of Object.entries(pose.set ?? {})) if (has(n)) set = x;
        for (const [n, o] of Object.entries(pose.origin ?? {})) if (has(n)) origin = o;
      }

      if (anim !== st.anim) st.animStart = now;
      st.visible = visible;
      st.anim = anim;
      st.set = set;
      st.origin = origin;
    }
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, facing: 1 | -1, now: number): void {
    const dt = this.lastDraw ? Math.min(now - this.lastDraw, 0.1) : 0;
    this.lastDraw = now;
    const step = dt / FLIP_SECONDS;
    this.visFacing += Math.max(-step, Math.min(step, facing - this.visFacing));

    if (now >= this.nextBlink) {
      this.blinkStart = now;
      this.nextBlink = now + 3.5 + Math.random() * 4;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.translate(this.cfg.flipAxisX, 0);
    ctx.scale(this.cfg.faces * this.visFacing, 1);
    ctx.translate(-this.cfg.flipAxisX, 0);
    this.drawNode(ctx, this.cfg.root, '#000', now);
    ctx.restore();
  }

  private drawNode(ctx: CanvasRenderingContext2D, node: SpriteNode, fill: string, now: number): void {
    const st = this.states.get(node)!;
    if (!st.visible) return;

    ctx.save();
    this.applyTransform(ctx, st, node, now);
    if (node.kind === 'group') {
      for (const c of node.children) this.drawNode(ctx, c, node.fill ?? fill, now);
    } else if (node.kind === 'rect') {
      ctx.fillStyle = node.fill ?? fill;
      ctx.fillRect(node.x, node.y, node.w, node.h);
    } else {
      const img = this.images.get(node.src);
      if (img?.complete) {
        ctx.imageSmoothingEnabled = false;
        if (node.clip) {
          ctx.beginPath();
          ctx.rect(node.clip.x, node.clip.y, node.clip.w, node.clip.h);
          ctx.clip();
        }
        ctx.drawImage(img, node.x, node.y, node.w, node.h);
      }
    }
    ctx.restore();
  }

  private applyTransform(ctx: CanvasRenderingContext2D, st: NodeState, node: SpriteNode, now: number): void {
    let anim = st.anim;
    let start = st.animStart;
    if (!anim && node.names?.includes('eye') && now - this.blinkStart < BLINK.duration) {
      anim = BLINK;
      start = this.blinkStart;
    }
    const sampled = anim ? sampleAnim(anim, now - start) : null;
    if (!st.set && !sampled) return;

    const [ox, oy] = st.origin;
    ctx.translate(ox, oy);
    for (const x of [st.set, sampled]) {
      if (!x) continue;
      ctx.translate(x.tx ?? 0, x.ty ?? 0);
      ctx.rotate((x.rot ?? 0) * DEG);
      ctx.scale(x.sx ?? 1, x.sy ?? 1);
      ctx.globalAlpha *= x.opacity ?? 1;
    }
    ctx.translate(-ox, -oy);
  }
}
