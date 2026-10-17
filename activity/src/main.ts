import '@fontsource/be-vietnam-pro/400.css';
import './style.css';
import { authenticateViewer, initSdk, isInsideDiscord, type Viewer } from './discord/auth';
import { Game } from './game';
import { DEFAULT_SPRITE, SPRITES } from './sprites';

const query = new URLSearchParams(location.search);
const sprite = SPRITES[query.get('model') ?? DEFAULT_SPRITE] ?? SPRITES[DEFAULT_SPRITE];

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
    // Outside Discord there is no instanceId; `?room=abc&name=An` lets two browser tabs share a pet for testing.
    const room = query.get('room');
    if (room) game.connectRoom(room, query.get('name') ?? 'Khách');
    else console.info('Not inside Discord: guest mode (local pet, no SDK). Add ?room=xyz to join a shared room.');
    return;
  }

  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
  if (!clientId) {
    game.greet('Thiếu VITE_DISCORD_CLIENT_ID trong .env');
    return;
  }

  const sdk = await initSdk(clientId);
  let viewer: Viewer | null = null;
  try {
    viewer = await authenticateViewer(sdk, clientId);
    game.greet(`Chào ${viewer.name}!`, viewer.avatarUrl);
  } catch (err) {
    console.error(err);
    game.greet('Không đăng nhập được Discord, pet chạy chế độ khách.');
  }
  // Everyone in the same voice-channel Activity shares one instanceId, hence one pet.
  game.connectRoom(sdk.instanceId, viewer?.name ?? 'Khách');
}

void boot().catch((err) => console.error(err));
