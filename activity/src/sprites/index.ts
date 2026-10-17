import type { SpriteConfig } from '../engine/types';
import { clawd } from './clawd';

// Adding a pet model = write a SpriteConfig (see clawd.ts) and register it here. The engine is untouched.
export const SPRITES: Record<string, SpriteConfig> = { clawd };

export const DEFAULT_SPRITE = 'clawd';
