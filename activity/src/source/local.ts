import { careIntervalMs } from '../data/care';
import { CARE_MESSAGES } from '../data/messages';
import { PetBrain } from '../engine/brain';
import type { Yard } from '../engine/types';
import type { SpriteMeta } from '../sprites/meta';
import type { PetSource, PetView } from './types';

const PAT_MS = 2000;
const CARE_RETRY_MS = 5000;

export class LocalSource implements PetSource {
  readonly kind = 'local' as const;
  readonly brain: PetBrain;
  private careText: string | null = null;
  private careIn: number;
  private pendingCare: string | null = null;

  constructor(yard: Yard, meta: SpriteMeta) {
    this.brain = new PetBrain({ yard, sprite: meta });
    this.careIn = this.nextCareDelay();
  }

  private nextCareDelay(): number {
    const [min, max] = careIntervalMs();
    return min + Math.random() * (max - min);
  }

  update(dtMs: number): void {
    this.brain.update(dtMs);
    if (this.careText && !this.brain.careActive) this.careText = null;

    this.careIn -= dtMs;
    if (this.careIn > 0) return;
    const text = this.pendingCare ?? CARE_MESSAGES[Math.floor(Math.random() * CARE_MESSAGES.length)];
    if (this.brain.showCare(text)) {
      this.careText = text;
      this.pendingCare = null;
      this.careIn = this.nextCareDelay();
    } else {
      this.pendingCare = text;
      this.careIn = CARE_RETRY_MS;
    }
  }

  view(): PetView {
    const b = this.brain;
    return { x: b.x, y: b.y, facing: b.facing, tags: b.tags(), careText: this.careText, food: b.food };
  }

  relayout(): void {
    this.brain.relayout();
  }
  startDrag(px: number, py: number): void {
    this.brain.startDrag(px, py);
  }
  dragTo(px: number, py: number): void {
    this.brain.dragTo(px, py);
  }
  endDrag(fall: boolean): void {
    this.brain.endDrag(fall);
  }
  hover(on: boolean): void {
    this.brain.setPatHover(on);
  }
  cursor(px: number, py: number): void {
    this.brain.noteCursor(px, py);
  }
  pat(): void {
    this.brain.patFor(PAT_MS);
  }
  feed(): void {
    this.brain.feed();
  }
}
