import { Hono } from 'hono';
import { apiApp } from './web-server';
import { WebSocketApp } from './websocket-server';
import { RoomDO } from './room-do';
import { logger } from 'hono/logger';

const APP = new Hono()
  // Mount the sub-apps at the root so the routes defined inside them
  // (like `/api/token`, `/ping`, and `/ws`) resolve to the expected paths
  .use(logger())
  .route('/api', apiApp)
  .route('/ws', WebSocketApp);

console.log('Started webserver and websocket server');
export default APP;
export type appType = typeof APP;

// Export the Durable Object class so the Cloudflare runtime can register it
export { RoomDO };
