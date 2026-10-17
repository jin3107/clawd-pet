import type { Obstacle, Yard } from '../engine/types';

const GROUND_BAND = 44;

// Mutated in place by layoutYard(): PetBrain and the drawing code hold this same object.
export const YARD: Yard = {
  width: 480,
  height: 270,
  groundY: 226,
  wallT: 6,
  obstacles: [
    { kind: 'rock', x: 110, w: 28, h: 10 },
    { kind: 'crate', x: 300, w: 34, h: 26 },
  ],
};

/** Fits the yard to the Activity frame (in yard units); obstacles keep their relative position. */
export function layoutYard(width: number, height: number): void {
  YARD.width = width;
  YARD.height = height;
  YARD.groundY = height - GROUND_BAND;
  const [rock, crate] = YARD.obstacles;
  rock.x = Math.round(width * 0.23 - rock.w / 2);
  crate.x = Math.round(width * 0.62 - crate.w / 2);
}

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

export function drawYard(ctx: CanvasRenderingContext2D, yard: Yard, timeSec: number): void {
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
