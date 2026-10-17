export type Ease = 'linear' | 'ease-in-out' | 'ease-out' | 'steps';

export interface Xform {
  tx?: number;
  ty?: number;
  rot?: number;
  sx?: number;
  sy?: number;
  opacity?: number;
}

export interface Keyframe extends Xform {
  at: number;
}

export interface Anim {
  duration: number;
  ease: Ease;
  keys: Keyframe[];
  delay?: number;
  once?: boolean;
  alternate?: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Origin = readonly [number, number] | 'center';

interface NodeBase {
  names?: string[];
  hidden?: boolean;
  origin?: Origin;
}

export interface GroupNode extends NodeBase {
  kind: 'group';
  fill?: string;
  children: SpriteNode[];
}

export interface RectNode extends NodeBase {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
}

export interface ImageNode extends NodeBase {
  kind: 'image';
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  clip?: Box;
}

export type SpriteNode = GroupNode | RectNode | ImageNode;

/** Applied like CSS rules: later/more specific poses override earlier ones, per node name. */
export interface Pose {
  show?: string[];
  hide?: string[];
  anim?: Record<string, Anim>;
  stop?: string[];
  set?: Record<string, Xform>;
  origin?: Record<string, readonly [number, number]>;
}

export interface SpriteConfig {
  id: string;
  label: string;
  /** Sprite-space x of the mirror axis used when flipping to face the other way. */
  flipAxisX: number;
  /** Direction the artwork faces by default: 1 = right, -1 = left. */
  faces: 1 | -1;
  /** Torso extents (collision with walls/obstacles) and the y of the soles. */
  body: { left: number; right: number; footY: number };
  hitbox: Box;
  headZone: Box;
  /** Tricks this model performs while idle. Names are understood by PetBrain. */
  tricks: string[];
  root: SpriteNode;
  /** Keys are state tags joined by '.', e.g. "fall.chute" matches when both tags are active. */
  poses: Record<string, Pose>;
}

export interface Obstacle {
  x: number;
  w: number;
  h: number;
  kind: 'crate' | 'rock';
}

export interface Yard {
  width: number;
  height: number;
  groundY: number;
  wallT: number;
  obstacles: Obstacle[];
}
