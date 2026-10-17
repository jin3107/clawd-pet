import type { Yard } from './types';

// Every client and the server simulate the same 2000-wide world so the shared pet lines up with the
// obstacles on everyone's screen; only the height (sky above the ground) varies per client.
export const WORLD_WIDTH = 2000;
export const GROUND_BAND = 44;

export function createYard(): Yard {
  return {
    width: WORLD_WIDTH,
    height: 600,
    groundY: 600 - GROUND_BAND,
    wallT: 6,
    obstacles: [
      { kind: 'rock', x: 0, w: 28, h: 10 },
      { kind: 'crate', x: 0, w: 34, h: 26 },
    ],
  };
}

/** Mutates in place: PetBrain and the drawing code hold the same Yard object. */
export function layoutYard(yard: Yard, height: number, groundY = height - GROUND_BAND): void {
  yard.width = WORLD_WIDTH;
  yard.height = height;
  yard.groundY = groundY;
  const [rock, crate] = yard.obstacles;
  rock.x = Math.round(WORLD_WIDTH * 0.23 - rock.w / 2);
  crate.x = Math.round(WORLD_WIDTH * 0.62 - crate.w / 2);
}

export function newWorld(height = 600): Yard {
  const yard = createYard();
  layoutYard(yard, height);
  return yard;
}
