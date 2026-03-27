import { Hono } from 'hono';

// Forward websocket upgrade requests to the RoomDO durable object.
// Uses a single default Durable Object instance for simplicity.
export const WebSocketApp = new Hono().on(['GET'], ['/initiate', '/initiate/'], async (c: any) => {
  if (c.req.header('upgrade') !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }

  // Use a single default DO instance. If you want per-room sharding,
  // change this to idFromName(roomId) where appropriate.
  const id = c.env.ROOM_DO.idFromName('default');
  const stub = c.env.ROOM_DO.get(id);

  // Forward the raw request to the DO. The DO's fetch will complete
  // the websocket handshake and return the 101 response.
  return await stub.fetch(c.req.raw);
});
