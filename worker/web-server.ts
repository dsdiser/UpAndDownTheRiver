import { Context, Hono } from 'hono';

interface OAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export const apiApp = new Hono<{ Bindings: Env }>()
  .on(['POST'], ['/token', '/token/'], async (c: Context) => {
    const ip = c.req.header('x-forwarded-for') || (c.req as any).conn?.remoteAddr || 'unknown';
    console.debug('Got request for /api/token for ' + ip);
    const body = await c.req.json();
    const code = body?.code;

    // Exchange the code for an access_token
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: c.env.VITE_DISCORD_CLIENT_ID,
        client_secret: c.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
    });
    // It looks like we aren't getting a successful response back here sometimes
    if (!response.ok) {
      const errorText = await response.text();
      return c.json(
        {
          error: `Failed to exchange code for access token ${response.status} ${response.statusText} - ${errorText}`,
          access_token: null,
        },
        500
      );
    }
    const data = (await response.json()) as OAuthResponse;
    const access_token = (data && data.access_token) || null;

    return c.json({ access_token, error: null });
  })
  .get('/ping', (c) => {
    return c.text('pong');
  });
