export class Bubble {
  private text = document.createElement('span');
  private avatar = document.createElement('img');
  private shown = false;

  constructor(private el: HTMLElement) {
    this.avatar.className = 'avatar';
    this.avatar.alt = '';
    this.avatar.addEventListener('error', () => (this.avatar.hidden = true));
    el.append(this.avatar, this.text);
  }

  get visible(): boolean {
    return this.shown;
  }

  show(message: string, avatarUrl?: string | null): void {
    this.text.textContent = message;
    this.avatar.hidden = !avatarUrl;
    if (avatarUrl) this.avatar.src = avatarUrl;
    this.el.hidden = false;
    this.shown = true;
  }

  hide(): void {
    this.el.hidden = true;
    this.shown = false;
  }

  /** (x, y) is the point just above the pet's head, in CSS px relative to the stage. */
  place(x: number, y: number, stageWidth: number): void {
    const w = this.el.offsetWidth;
    const left = Math.min(Math.max(Math.round(x - w / 2), 4), Math.max(4, stageWidth - w - 4));
    this.el.style.transform = `translate(${left}px, ${Math.round(y)}px) translateY(-100%)`;
    this.el.style.setProperty('--tail-x', `${Math.round(x - left)}px`);
  }
}
