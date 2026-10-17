import type { SpriteConfig } from '../engine/types';

/** The part of a sprite the simulation needs. Pure data, so the Node server can import it
 *  without pulling in image assets or DOM code from the full SpriteConfig. */
export type SpriteMeta = Pick<SpriteConfig, 'body' | 'tricks' | 'anchors'>;

export const SPRITE_META: Record<string, SpriteMeta> = {
  clawd: {
    body: { left: 10, right: 70, footY: 55 },
    tricks: ['code', 'jump', 'music', 'soccer', 'climb', 'surf', 'think', 'coffee'],
    // handDown / handUp are the right arm's tip at rotate(75deg) and rotate(-60deg) about the shoulder (70,20).
    anchors: { handDown: [75, 36], handUp: [79, 5], mouth: [40, 24] },
  },
};

export const DEFAULT_MODEL = 'clawd';
