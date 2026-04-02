import { DurableObjectClass, DurableObjectState, WebSocket } from '@cloudflare/workers-types';
import { MessageType } from '../types/messages';
import type { PlayedCard, GameStartMessage, CardPlayRequestMessage } from '../types/messages';
import {
  RoomMember,
  RoomGameState,
  isRecord,
  isJoinMessage,
  isGameStartMessage,
  isCardPlayRequestMessage,
  gameStateKey,
  buildInitialGameState,
  buildGameStateSyncMessage,
  buildCardPlayedMessage,
  isString,
} from './helpers/room-do-helpers';

type AnyRecord = Record<string, unknown>;

export class RoomDO implements DurableObjectClass {
  state: DurableObjectState;
  env: AnyRecord;
  connections: Map<string, Set<RoomMember>>;
  roomStates: Map<string, RoomGameState>;

  constructor(state: DurableObjectState, env: AnyRecord) {
    this.state = state;
    this.env = env;
    this.connections = new Map<string, Set<RoomMember>>();
    this.roomStates = new Map<string, RoomGameState>();

    // Rehydrate any accepted websockets after hibernation if supported
    try {
      const websockets = this.state.getWebSockets() || [];
      if (!websockets) return;

      for (const ws of websockets) {
        // Recreates rooms after hibernation based on serialized attachment
        let meta = ws.deserializeAttachment();
        if (!meta || !meta.roomId || !meta.userId) continue;
        this.addMemberToRoom(meta.roomId, { userId: meta.userId, avatar: meta.avatar, ws });
      }
    } catch (e) {
      console.debug('RoomDO: websocket rehydration failed', e);
    }
  }

  private async getRoomGameState(roomId: string): Promise<RoomGameState | null> {
    if (this.roomStates.has(roomId)) return this.roomStates.get(roomId)!;
    const state = await this.state.storage.get<RoomGameState>(gameStateKey(roomId));
    if (!state) return null;
    this.roomStates.set(roomId, state);
    return state;
  }

  private async saveRoomGameState(roomId: string, gameState: RoomGameState): Promise<void> {
    gameState.lastUpdated = Date.now();
    this.roomStates.set(roomId, gameState);
    await this.state.storage.put(gameStateKey(roomId), gameState);
  }

  private hasMember(roomId: string, userId: string) {
    const members = this.connections.get(roomId);
    if (!members) return false;
    return Array.from(members).some((m) => m.userId === userId);
  }

  private async handleGameStart(msg: GameStartMessage) {
    const { roomId, userId } = msg;
    if (!this.hasMember(roomId, userId)) return;

    const existingState = await this.getRoomGameState(roomId);
    if (existingState) {
      this.broadcast(roomId, JSON.stringify(buildGameStateSyncMessage(roomId, existingState)));
      return;
    }
    const seed = Math.floor(Math.random() * 1_000_000);
    const gameState = buildInitialGameState(roomId, seed, this.listMembers(roomId));
    await this.saveRoomGameState(roomId, gameState);
    this.broadcast(roomId, JSON.stringify(buildGameStateSyncMessage(roomId, gameState)));
    this.broadcast(
      roomId,
      JSON.stringify({
        type: MessageType.GameStart,
        userId,
        roomId,
        id: `${roomId}:${Date.now()}`,
        timestamp: Date.now(),
        seed,
      })
    );
  }

  private async handleCardPlayRequest(msg: CardPlayRequestMessage) {
    const { roomId, userId, card } = msg;
    if (!this.hasMember(roomId, userId)) return;

    const gameState = await this.getRoomGameState(roomId);
    if (!gameState) return;
    if (gameState.activePlayerId !== userId) return;
    const hand = gameState.playerHands[userId] || [];
    const cardIndex = hand.indexOf(card);
    if (cardIndex === -1) return;

    const playedCard: PlayedCard = {
      userId,
      card,
      timestamp: msg.timestamp ?? Date.now(),
    };
    gameState.playerHands[userId] = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
    gameState.currentTrick = [...gameState.currentTrick, playedCard];
    gameState.playedCards = [...gameState.playedCards, playedCard];

    const currentIndex = gameState.turnOrder.indexOf(userId);
    const nextIndex = (currentIndex + 1) % gameState.turnOrder.length;
    gameState.activePlayerId = gameState.turnOrder[nextIndex];

    await this.saveRoomGameState(roomId, gameState);

    const playedMessage = buildCardPlayedMessage(roomId, gameState, playedCard);
    this.broadcast(roomId, JSON.stringify(playedMessage));
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
  async webSocketMessage(ws: WebSocket, data: string) {
    try {
      const msg: unknown = JSON.parse(data.toString());
      if (!isRecord(msg) || !isString(msg.roomId)) return;

      if (isJoinMessage(msg)) {
        this.addMemberToRoom(msg.roomId, { userId: msg.userId, avatar: msg.avatar, ws });
        this.broadcast(
          msg.roomId,
          JSON.stringify({
            type: MessageType.Presence,
            userId: 'server',
            roomId: msg.roomId,
            id: `${msg.roomId}:${Date.now()}`,
            timestamp: Date.now(),
            members: this.listMembers(msg.roomId),
          })
        );

        // If the player is joining, we just sync them to the current game state.
        // This could happen if a user disconnects and reconnects.
        const gameState = await this.getRoomGameState(msg.roomId);
        if (gameState) {
          ws.send(JSON.stringify(buildGameStateSyncMessage(msg.roomId, gameState)));
        }
        return;
      }
      // for other message types, the user must already be a member of the room
      if (!msg.userId || !isString(msg.userId) || !this.hasMember(msg.roomId, msg.userId)) return;

      if (msg.type == MessageType.GameStart && isGameStartMessage(msg)) {
        await this.handleGameStart(msg);
      } else if (msg.type == MessageType.CardPlayRequest && isCardPlayRequestMessage(msg)) {
        await this.handleCardPlayRequest(msg);
      } else {
        // For any other message types, we just broadcast them to the room.
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
      if (set.size === 0) {
        this.connections.delete(roomId);
      }
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
