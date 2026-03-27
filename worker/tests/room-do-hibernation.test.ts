import { test, expect } from 'vitest';
import { RoomDO } from '../room-do';

// Minimal mock WebSocket
class MockWS {
  readyState = 1;
  sent: string[] = [];
  send(s: string) {
    this.sent.push(s);
  }
}

// Mock DurableObjectState with getWebSockets returning a rehydrated socket
const createMockState = (rehydratedSockets: any[] = []) => {
  return {
    getWebSockets: () => rehydratedSockets,
    acceptWebSocket: (_: any) => {},
  } as any;
};

test('rehydrated websocket can join and receive broadcasts after hibernation', async () => {
  const rehydrated = new MockWS();
  const state = createMockState([rehydrated]);
  const env = {} as any;

  const doInstance = new RoomDO(state, env);

  // Simulate the client sending a 'join' message from the rehydrated socket
  const joinMsg = JSON.stringify({ type: 'join', roomId: 'r1', userId: 'u1' });
  // Call the handler as if the rehydrated websocket sent a message
  doInstance.webSocketMessage(rehydrated as any, joinMsg);

  // Now broadcast a message to the room
  await doInstance.broadcast('r1', JSON.stringify({ type: 'msg', text: 'hello' }));

  expect(rehydrated.sent.some((s) => s.includes('hello'))).toBe(true);
});
