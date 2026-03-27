import { DurableObjectClass, DurableObjectState, WebSocket } from '@cloudflare/workers-types';

type AnyRecord = Record<string, unknown>;

interface RoomMember {
  userId: string;
  avatar?: string;
  ws: WebSocket; // Cloudflare WebSocket
}

export class RoomDO implements DurableObjectClass {
  state: DurableObjectState;
  env: AnyRecord;
  connections: Map<string, Set<RoomMember>>;

  constructor(state: DurableObjectState, env: AnyRecord) {
    this.state = state;
    this.env = env;
    this.connections = new Map<string, Set<RoomMember>>();

    // Rehydrate any accepted websockets after hibernation if supported
    try {
      const websockets = this.state.getWebSockets() || [];
      if (websockets) {
        for (const ws of websockets) {
          // Recreates rooms after hibernation based on serialized attachment
          let meta = ws.deserializeAttachment();
          if (!meta || !meta.roomId || !meta.userId) continue;
          this.addMemberToRoom(meta.roomId, { userId: meta.userId, avatar: meta.avatar, ws });
        }
      }
    } catch (e) {
      console.debug('RoomDO: websocket rehydration failed', e);
    }
  }

  // fetch is used as the handoff for websocket upgrades from the Worker
  async fetch(request: Request) {
    const upgradeHeader = request.headers.get('upgrade') || '';
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const pair = new (globalThis as any).WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Accept the server side so Cloudflare can hibernate the DO when idle
    this.state.acceptWebSocket(server);
    if (client && typeof client.addEventListener === 'function') {
      client.addEventListener('close', () => this.removeSocketFromAllRooms(client));
      client.addEventListener('error', () => this.removeSocketFromAllRooms(client));
    }

    try {
      // In Cloudflare Workers this is valid: status 101 with webSocket
      return new Response(null, { status: 101, webSocket: client } as any);
    } catch (err) {
      // If the environment (e.g., node test runner) doesn't support 101 responses,
      // fall back to a harmless 200 response so the caller doesn't crash.
      console.warn('RoomDO: returning fallback response because environment rejected 101:', err);
      return new Response('Websocket upgrade not supported in this environment', { status: 200 });
    }
  }

  // Durable Object Hibernation API handlers
  webSocketMessage(ws: WebSocket, data: string) {
    try {
      const msg = JSON.parse(data.toString());
      if (
        msg &&
        msg.type === 'join' &&
        typeof msg.roomId === 'string' &&
        typeof msg.userId === 'string'
      ) {
        this.addMemberToRoom(msg.roomId, { userId: msg.userId, avatar: msg.avatar, ws });
        // broadcast presence
        this.broadcast(
          msg.roomId,
          JSON.stringify({
            type: 'presence',
            roomId: msg.roomId,
            members: this.listMembers(msg.roomId),
          })
        );
        return;
      }

      // Other messages are treated as room broadcasts if they include roomId
      if (msg && typeof msg.roomId === 'string') {
        this.broadcast(msg.roomId, JSON.stringify(msg));
      }
    } catch (err) {
      console.warn('RoomDO: Failed to handle message', err);
    }
  }

  webSocketClose(ws: any, _code: number, _reason: string, _wasClean: boolean) {
    this.removeSocketFromAllRooms(ws);
  }

  webSocketError(ws: any, _error: unknown) {
    this.removeSocketFromAllRooms(ws);
  }

  addMemberToRoom(roomId: string, member: RoomMember) {
    if (!this.connections.has(roomId)) this.connections.set(roomId, new Set<RoomMember>());
    const set = this.connections.get(roomId)!;
    // Remove any existing member with same ws
    for (const m of set) {
      if (m.ws === member.ws) {
        set.delete(m);
      }
    }
    set.add(member);
    member.ws.serializeAttachment({
      roomId,
      userId: member.userId,
      avatar: member.avatar,
    });
  }
  removeSocketFromAllRooms(ws: any) {
    for (const [roomId, set] of this.connections.entries()) {
      // if m is in set with ws, delete it then broadcast a presence update
      const member = Array.from(set).find((m) => m.ws === ws);
      if (!member) continue;
      set.delete(member);
      if (set.size === 0) this.connections.delete(roomId);
      this.broadcast(
        roomId,
        JSON.stringify({
          type: 'presence',
          roomId: roomId,
          members: this.listMembers(roomId),
        })
      );
    }
  }

  listMembers(roomId: string) {
    const set = this.connections.get(roomId);
    if (!set) return [];
    return Array.from(set).map((m) => ({ id: m.userId, avatar: m.avatar }));
  }

  broadcast(roomId: string, message: string) {
    const set = this.connections.get(roomId);
    if (!set) return;
    for (const member of Array.from(set)) {
      try {
        if (member.ws.readyState === 1) member.ws.send(message);
        else {
          set.delete(member);
        }
      } catch (e) {
        console.warn('RoomDO: failed to send to member', e);
        set.delete(member);
      }
    }
    if (set.size === 0) this.connections.delete(roomId);
  }
}
