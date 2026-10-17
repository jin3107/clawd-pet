import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';

const { VITE_DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret } = process.env;
const port = Number(process.env.PORT) || 3001;

if (!clientId || !clientSecret) {
  console.error('Missing VITE_DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Exchanges the one-time `code` from sdk.commands.authorize() for an access_token.
// The exchange needs client_secret, which is why this lives on the server.
app.post('/api/token', async (req, res) => {
  const code = req.body?.code;
  if (typeof code !== 'string' || code.length === 0) {
    return res.status(400).json({ error: 'missing_code' });
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!response.ok) {
      console.error('Token exchange failed:', response.status, await response.text());
      return res.status(502).json({ error: 'token_exchange_failed' });
    }

    const { access_token } = await response.json();
    res.json({ access_token });
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(502).json({ error: 'token_exchange_failed' });
  }
});

if (existsSync('dist')) {
  app.use(express.static('dist'));
}

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
