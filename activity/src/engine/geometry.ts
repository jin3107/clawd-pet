import type { SpriteConfig, Yard } from './types';

/** Range of the sprite's left edge (x) that keeps its torso between the two fence posts. */
export function xBounds(yard: Yard, body: SpriteConfig['body']): [min: number, max: number] {
  return [yard.wallT - body.left, yard.width - yard.wallT - body.right];
}
