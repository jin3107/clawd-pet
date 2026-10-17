import type { Obstacle, Yard } from '../engine/types';

const SKY = ['#BFE3F2', '#CDEAF5', '#DCF1F8', '#EAF7FB'];
const CLOUD = '#FFFFFF';
const POST = '#8B5A3C';
const POST_DARK = '#6B4128';

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = CLOUD;
  ctx.fillRect(x + 8, y, 24, 6);
  ctx.fillRect(x, y + 6, 44, 6);
  ctx.fillRect(x + 12, y + 12, 28, 4);
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle, groundY: number): void {
  const top = groundY - o.h;
  if (o.kind === 'crate') {
    ctx.fillStyle = POST_DARK;
    ctx.fillRect(o.x, top, o.w, o.h);
    ctx.fillStyle = '#C08A4F';
    ctx.fillRect(o.x + 2, top + 2, o.w - 4, o.h - 4);
    ctx.fillStyle = POST;
    ctx.fillRect(o.x + 2, top + o.h / 2 - 1, o.w - 4, 2);
    ctx.fillRect(o.x + o.w / 2 - 1, top + 2, 2, o.h - 4);
  } else {
    ctx.fillStyle = '#7C838A';
    ctx.fillRect(o.x + 4, top, o.w - 8, o.h);
    ctx.fillRect(o.x, top + 4, o.w, o.h - 4);
    ctx.fillStyle = '#9AA0A6';
    ctx.fillRect(o.x + 6, top + 1, o.w - 14, 3);
  }
}

/** Drawn after the pet so a cookie in its hand shows in front of the body. */
export function drawFood(ctx: CanvasRenderingContext2D, food: { x: number; ry: number; s: number }, groundY: number): void {
  const w = Math.max(3, Math.round(14 * food.s));
  const h = Math.max(2, Math.round(w * 0.8));
  const x = Math.round(food.x - w / 2);
  const y = Math.round(groundY + food.ry - h / 2);
  ctx.fillStyle = '#8B5A3C';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#E0B26B';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#F0CB8A';
  ctx.fillRect(x, y, w, Math.min(2, h));
  if (w >= 10) {
    ctx.fillStyle = '#6B4128';
    ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillRect(x + w - 6, y + h - 5, 2, 2);
  }
}

export function drawYard(
  ctx: CanvasRenderingContext2D,
  yard: Yard,
  timeSec: number,
): void {
  const { width: w, height: h, groundY, wallT } = yard;

  const band = Math.ceil(groundY / SKY.length);
  SKY.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * band, w, band);
  });

  const drift = (timeSec * 3) % (w + 60);
  drawCloud(ctx, ((drift + 40) % (w + 60)) - 50, 28);
  drawCloud(ctx, ((drift + 260) % (w + 60)) - 50, 58);

  ctx.fillStyle = '#A8D5A2';
  for (let x = 0; x < w; x += 40) {
    const hh = 14 + ((x / 40) % 3) * 8;
    ctx.fillRect(x, groundY - hh, 40, hh);
  }

  ctx.fillStyle = '#B98B5E';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = '#7DBB6A';
  ctx.fillRect(0, groundY, w, 6);
  ctx.fillStyle = '#93CC7D';
  ctx.fillRect(0, groundY, w, 2);
  ctx.fillStyle = '#A27549';
  for (let x = 8; x < w; x += 22) ctx.fillRect(x + ((x * 7) % 11), groundY + 14 + ((x * 3) % 5) * 6, 4, 2);

  ctx.fillStyle = '#AE8257';
  ctx.fillRect(0, groundY + 70, w, h - groundY - 70);
  ctx.fillStyle = '#A27549';
  ctx.fillRect(0, groundY + 170, w, h - groundY - 170);

  for (const o of yard.obstacles) drawObstacle(ctx, o, groundY);

  const postH = Math.min(120, groundY - 10);
  for (const x of [0, w - wallT]) {
    ctx.fillStyle = POST;
    ctx.fillRect(x, groundY - postH, wallT, postH);
    ctx.fillStyle = POST_DARK;
    ctx.fillRect(x + (x === 0 ? wallT - 2 : 0), groundY - postH, 2, postH);
    ctx.fillRect(x - (x === 0 ? 0 : 1), groundY - postH, wallT + 1, 3);
  }
}
