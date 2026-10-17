import type { Anim, GroupNode, Keyframe, RectNode, SpriteNode } from '../engine/types';

type NodeOpts = Partial<Omit<GroupNode, 'kind' | 'children'>>;

export const rect = (x: number, y: number, w: number, h: number, fill?: string, names?: string[]): RectNode => ({
  kind: 'rect',
  x,
  y,
  w,
  h,
  fill,
  names,
});

export const group = (children: SpriteNode[], opts: NodeOpts = {}): GroupNode => ({
  kind: 'group',
  children,
  ...opts,
});

export const anim = (
  duration: number,
  ease: Anim['ease'],
  keys: Keyframe[],
  opts: Pick<Anim, 'delay' | 'once' | 'alternate'> = {},
): Anim => ({ duration, ease, keys, ...opts });
