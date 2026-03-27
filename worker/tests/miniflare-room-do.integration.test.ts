import { describe, it, expect } from 'vitest';
import { Miniflare } from 'miniflare';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

describe('miniflare: RoomDO websocket integration', () => {
  it('accepts websocket connections, allows join/broadcast and survives hibernation', async () => {
    // Prefer a built bundle if available (dist/main.js), otherwise use source
    const builtPath = fileURLToPath(new URL('../dist/main.js', import.meta.url));
    const miniflareOptions: any = {
      scriptPath: builtPath,
      modules: true,
      durableObjects: {
        // Bind the name ROOM_DO to the class RoomDO exported by the module
        ROOM_DO: { className: 'RoomDO' },
      },
      host: '127.0.0.1',
      port: 8787,
    };
    const webSocketUrl = 'ws://localhost:8787/ws';

    let mf = new Miniflare(miniflareOptions);
    let url = await mf.ready;

    try {
      // Connect two websocket clients to the /ws endpoint
      const ws1 = new WebSocket(webSocketUrl);
      const ws2 = new WebSocket(webSocketUrl);

      const waitOpen = (ws: WebSocket) =>
        new Promise<void>((resolve, reject) => {
          ws.once('open', () => resolve());
          ws.once('error', (err) => reject(err));
        });

      await Promise.all([waitOpen(ws1), waitOpen(ws2)]);

      const recv = (ws: WebSocket) =>
        new Promise<string>((resolve) => {
          ws.once('message', (data) => resolve(data.toString()));
        });

      // Have ws1 join room r1 as user u1
      ws1.send(JSON.stringify({ type: 'join', roomId: 'r1', userId: 'u1' }));
      // Wait for the join ack or presence message
      const ack1 = await recv(ws1);
      expect(ack1).toContain('joined');

      // Have ws2 join r1 as u2
      ws2.send(JSON.stringify({ type: 'join', roomId: 'r1', userId: 'u2' }));
      const ack2 = await recv(ws2);
      expect(ack2).toContain('joined');

      // ws1 sends a chat message which should be broadcast to ws2
      await recv(ws2); // drain any presence message
      ws1.send(JSON.stringify({ type: 'msg', roomId: 'r1', text: 'hello-miniflare' }));
      const msgOn2 = await recv(ws2);
      expect(msgOn2).toContain('hello-miniflare');

      // Simulate hibernation by disposing and recreating Miniflare, which
      // should rehydrate DOs from persistent storage.
      // wait 10 seconds to ensure DO hibernation
      await new Promise((r) => setTimeout(r, 10000));
      console.log('Miniflare disposed to simulate hibernation');
      // wait until the new instance is ready (Miniflare exposes `ready` as a
      // promise-like property)
      if (mf.ready) await mf.ready;

      // Reconnect sockets (Miniflare will rebind any previously accepted websockets)
      const ws3 = new WebSocket(webSocketUrl);
      const ws4 = new WebSocket(webSocketUrl);
      await Promise.all([waitOpen(ws3), waitOpen(ws4)]);

      // Join again from a rehydrated context and broadcast
      ws3.send(JSON.stringify({ type: 'join', roomId: 'r1', userId: 'u3' }));
      await recv(ws3);
      ws3.send(JSON.stringify({ type: 'msg', roomId: 'r1', text: 'after-hib' }));
      // message not making it to ws2
      const m = await recv(ws2);
      expect(m).toContain('after-hib');

      ws1.close();
      ws2.close();
      ws3.close();
      ws4.close();
    } finally {
      try {
        if (mf) await mf.dispose();
      } catch (e) {
        // ignore
      }
    }
  }, 15000);
});
