# Coin Flip — Discord Activity

Multiplayer lobby that runs as a Discord Activity so you can flip coins together inside Discord or on any webpage.

## Features

- Multiplayer lobby for joining a coin flip session
- Real-time flips resolved in the activity or on the webpage

## Dependencies

Client (UI):

- React - TypeScript
- @discord/embedded-app-sdk
- Vite (dev & build)
- OGL (for background animation shader)
- Motion (for coin animation)
- random-js (prng)
- Jotai (state management)

Server (Cloudflare Worker):

- Hono (web framework)
- Durable Objects for session management + Websocket Hibernation

## Quick start (development)

From the repository root:

```cmd
npm install
npm run dev
```

Available scripts:

- `npm run dev` - Start development server with Vite
- `npm run build` - Build the client app
- `npm run preview` - Preview the built app
- `npm run test` - Run tests (builds the server code first in order to use for integration testing with Miniflare)
- `npm run cf-typegen` - Generate Cloudflare Worker types

## Deployment

This project is designed to run on Cloudflare Workers with:

- Static assets served via Cloudflare Pages/Workers
- WebSocket connections handled by Durable Objects
- Real-time multiplayer state management

Use `wrangler.jsonc` and environment variables to configure deployment settings.

The client uses the Discord Embedded App SDK to run as an Activity inside Discord. Make sure to set up Discord redirects in the application to ensure traffic gets routed properly from inside the iframe.
