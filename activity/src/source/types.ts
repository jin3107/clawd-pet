export interface PetView {
  x: number;
  /** Absolute y in this client's yard (already converted from the ground-relative wire value). */
  y: number;
  facing: 1 | -1;
  tags: string[];
  careText: string | null;
  food: { x: number; ry: number; s: number } | null;
}

/** Where the pet's state comes from: a local simulation (guest) or the room's server (shared). */
export interface PetSource {
  readonly kind: 'local' | 'net';
  update(dtMs: number): void;
  view(): PetView;
  relayout(): void;
  startDrag(px: number, py: number): void;
  dragTo(px: number, py: number): void;
  endDrag(fall: boolean): void;
  hover(on: boolean): void;
  cursor(px: number, py: number): void;
  pat(): void;
  feed(): void;
}
