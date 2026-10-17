import '@fontsource/be-vietnam-pro/400.css';
import './style.css';
import { connectDiscord, isInsideDiscord } from './discord/auth';
import { Game } from './game';
import { DEFAULT_SPRITE, SPRITES } from './sprites';

const modelId = new URLSearchParams(location.search).get('model') ?? DEFAULT_SPRITE;
const sprite = SPRITES[modelId] ?? SPRITES[DEFAULT_SPRITE];

const game = new Game(
  document.getElementById('yard') as HTMLCanvasElement,
  document.getElementById('stage')!,
  document.getElementById('bubble')!,
  sprite,
);
game.start();
if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;

async function boot(): Promise<void> {
  if (!isInsideDiscord()) {
    console.info('Not inside Discord: running in guest mode (no SDK / auth).');
    return;
  }
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    game.say('Thiếu VITE_DISCORD_CLIENT_ID trong .env');
    return;
  }
  try {
    const { viewer } = await connectDiscord(clientId);
    game.say(`Chào ${viewer.name}!`, viewer.avatarUrl);
  } catch (err) {
    console.error(err);
    game.say('Không đăng nhập được Discord, pet chạy chế độ khách.');
  }
}

void boot();
