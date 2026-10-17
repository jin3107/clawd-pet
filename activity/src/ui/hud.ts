export class Hud {
  private presence = document.getElementById('presence')!;
  private toastEl = document.getElementById('toast')!;
  private toastTimer = 0;

  constructor(handlers: { onFeed: () => void; onPat: () => void }) {
    document.getElementById('btn-feed')!.addEventListener('click', handlers.onFeed);
    document.getElementById('btn-pat')!.addEventListener('click', handlers.onPat);
  }

  /** `names` empty/null hides the counter (guest mode or disconnected). */
  setPresence(names: string[] | null): void {
    if (!names || names.length === 0) {
      this.presence.hidden = true;
      return;
    }
    this.presence.hidden = false;
    this.presence.textContent = `${names.length} người`;
    this.presence.title = names.join(', ');
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), 2500);
  }
}
