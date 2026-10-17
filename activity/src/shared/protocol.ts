// Wire format between the browser and server/. All positions are in the shared 2000-wide world;
// `ry` is a y measured from the ground line (negative = above it), because the sky height differs per client.

export interface Snapshot {
  x: number;
  ry: number;
  facing: 1 | -1;
  tags: string[];
  care: string | null;
  food: { x: number; ry: number; s: number } | null;
}

export type ClientMsg =
  | { t: 'join'; room: string; name: string; model: string }
  | { t: 'cursor'; x: number; ry: number }
  | { t: 'hover'; on: boolean }
  | { t: 'dragStart'; x: number; ry: number }
  | { t: 'drag'; x: number; ry: number }
  | { t: 'dragEnd'; fall: boolean }
  | { t: 'pat' }
  | { t: 'feed' };

export type ServerMsg =
  | { t: 'welcome'; id: string; model: string; snap: Snapshot; names: string[] }
  | { t: 'snap'; s: Snapshot }
  | { t: 'presence'; names: string[] }
  | { t: 'event'; kind: 'feed' | 'pat'; by: string }
  | { t: 'drag-denied' };
