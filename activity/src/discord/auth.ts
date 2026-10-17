import { DiscordSDK } from '@discord/embedded-app-sdk';

export interface Viewer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface DiscordSession {
  sdk: DiscordSDK;
  viewer: Viewer;
}

// Discord loads Activities in an iframe with ?frame_id=...; opening the page in a normal tab has no such param.
export const isInsideDiscord = (): boolean => new URLSearchParams(location.search).has('frame_id');

// Avatars live on cdn.discordapp.com, which the Activity CSP blocks. Add a URL Mapping
// (prefix /discord-cdn -> cdn.discordapp.com) and the request is proxied; without it the bubble just omits the avatar.
const avatarUrl = (id: string, hash: string | null | undefined) =>
  hash ? `/.proxy/discord-cdn/avatars/${id}/${hash}.png?size=64` : null;

export async function connectDiscord(clientId: string): Promise<DiscordSession> {
  const sdk = new DiscordSDK(clientId);
  await sdk.ready();

  const { code } = await sdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify'],
  });

  const res = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const { access_token } = (await res.json()) as { access_token: string };

  const auth = await sdk.commands.authenticate({ access_token });
  if (!auth) throw new Error('authenticate() returned no session');

  const u = auth.user;
  return {
    sdk,
    viewer: { id: u.id, name: u.global_name ?? u.username, avatarUrl: avatarUrl(u.id, u.avatar) },
  };
}
