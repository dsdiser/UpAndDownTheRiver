# Up and Down the River — Online Game

Online "Up and Down the River" game that provides a Multiplayer lobby that also runs as a Discord Activity.

## Features

- Multiplayer lobby
- TBD

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
