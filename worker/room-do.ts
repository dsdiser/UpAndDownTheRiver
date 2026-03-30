import { DurableObjectClass, DurableObjectState, WebSocket } from '@cloudflare/workers-types';
import { allPlayingCards } from '../client/types/cards';
import { MessageType } from '../types/messages';
import type {
  CardFace,
  PlayedCard,
  JoinMessage,
  CardPlayRequestMessage,
  GameStateSyncMessage,
  CardPlayedMessage,
  GameStartMessage,
} from '../types/messages';
import { GameState } from '../client/types/gameState';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isJoinMessage(value: unknown): value is JoinMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.Join &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isString(value.id) &&
    (value.avatar === undefined || isString(value.avatar))
  );
}

function isGameStartMessage(value: unknown): value is GameStartMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.GameStart &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isNumber(value.seed) &&
    isString(value.id)
  );
}

function isCardPlayRequestMessage(value: unknown): value is CardPlayRequestMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.CardPlayRequest &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isString(value.card) &&
    isString(value.id)
  );
}

interface RoomMember {
  userId: string;
  avatar?: string;
  ws: WebSocket; // Cloudflare WebSocket
}

type RoomGameState = {
  phase: GameState;
  seed: number;
  roundNumber: number;
  handSize: number;
  roundDirection: 'up' | 'down';
  maxHandSize: number;
  trumpCard: CardFace | null;
  sortedDeck: CardFace[];
  shuffledDeck: CardFace[];
  drawPile: CardFace[];
  playerHands: Record<string, CardFace[]>;
  playedCards: PlayedCard[];
  currentTrick: PlayedCard[];
  turnOrder: string[];
  activePlayerId: string | null;
  scores: Record<string, number>;
  lastUpdated: number;
};

const GAME_STATE_KEY_PREFIX = 'gameState:';

function gameStateKey(roomId: string) {
  return `${GAME_STATE_KEY_PREFIX}${roomId}`;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildSortedDeck(): CardFace[] {
  return allPlayingCards.map((card) => card.face);
}

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

  private buildInitialGameState(roomId: string, seed: number): RoomGameState {
    const sortedDeck = buildSortedDeck();
    const shuffledDeck = seededShuffle(sortedDeck, seed);
    const members = this.listMembers(roomId);
    const turnOrder = members.map((member) => member.id);
    const maxHandSize = Math.min(
      10,
      Math.floor(shuffledDeck.length / Math.max(turnOrder.length, 1))
    );
    const handSize = 1;
    const playerHands: Record<string, CardFace[]> = {};

    for (let i = 0; i < turnOrder.length; i++) {
      const start = i * handSize;
      playerHands[turnOrder[i]] = shuffledDeck.slice(start, start + handSize);
    }

    const drawPile = shuffledDeck.slice(handSize * turnOrder.length);
    const trumpCard = drawPile.length > 0 ? drawPile[0] : null;
    const remainingDrawPile = trumpCard ? drawPile.slice(1) : drawPile;

    return {
      phase: GameState.DealingCards,
      seed,
      roundNumber: 1,
      handSize,
      roundDirection: 'up',
      maxHandSize,
      trumpCard,
      sortedDeck,
      shuffledDeck,
      drawPile: remainingDrawPile,
      playerHands,
      playedCards: [],
      currentTrick: [],
      turnOrder,
      activePlayerId: turnOrder.length > 0 ? turnOrder[0] : null,
      scores: turnOrder.reduce<Record<string, number>>((acc, id) => {
        acc[id] = 0;
        return acc;
      }, {}),
      lastUpdated: Date.now(),
    };
  }

  private buildGameStateSyncMessage(
    roomId: string,
    gameState: RoomGameState
  ): GameStateSyncMessage {
    return {
      type: MessageType.GameStateSync,
      userId: 'server',
      roomId,
      id: `${roomId}:${Date.now()}`,
      timestamp: Date.now(),
      phase: gameState.phase,
      roundNumber: gameState.roundNumber,
      handSize: gameState.handSize,
      roundDirection: gameState.roundDirection,
      maxHandSize: gameState.maxHandSize,
      trumpCard: gameState.trumpCard,
      activePlayerId: gameState.activePlayerId,
      turnOrder: gameState.turnOrder,
      trick: gameState.currentTrick,
      playedCards: gameState.playedCards,
      playerHandSizes: Object.fromEntries(
        Object.entries(gameState.playerHands).map(([playerId, hand]) => [playerId, hand.length])
      ),
      scores: gameState.scores,
      playerHands: gameState.playerHands,
    };
  }

  private buildCardPlayedMessage(
    roomId: string,
    gameState: RoomGameState,
    playedCard: PlayedCard
  ): CardPlayedMessage {
    return {
      type: MessageType.CardPlayed,
      userId: playedCard.userId,
      roomId,
      id: `${roomId}:${Date.now()}`,
      timestamp: playedCard.timestamp,
      card: playedCard.card,
      activePlayerId: gameState.activePlayerId,
      trick: gameState.currentTrick,
      remainingHandCount: gameState.playerHands[playedCard.userId]?.length ?? 0,
    };
  }

  private hasMember(roomId: string, userId: string) {
    const members = this.connections.get(roomId);
    if (!members) return false;
    return Array.from(members).some((m) => m.userId === userId);
  }

  private async handleGameStart(msg: GameStartMessage) {
    const { roomId, seed, userId } = msg;
    if (!this.hasMember(roomId, userId)) return;

    const existingState = await this.getRoomGameState(roomId);
    if (existingState) {
      this.broadcast(roomId, JSON.stringify(this.buildGameStateSyncMessage(roomId, existingState)));
      return;
    }

    const gameState = this.buildInitialGameState(roomId, seed);
    await this.saveRoomGameState(roomId, gameState);

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
    this.broadcast(roomId, JSON.stringify(this.buildGameStateSyncMessage(roomId, gameState)));
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

    const playedMessage = this.buildCardPlayedMessage(roomId, gameState, playedCard);
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
      if (!isRecord(msg)) return;
      if (typeof msg.type !== 'string') return;

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

        const gameState = await this.getRoomGameState(msg.roomId);
        if (gameState) {
          ws.send(JSON.stringify(this.buildGameStateSyncMessage(msg.roomId, gameState)));
        }
        return;
      }

      if (!isRecord(msg)) return;
      if (typeof msg.roomId !== 'string') return;

      switch (msg.type) {
        case MessageType.GameStart:
          if (!isGameStartMessage(msg)) return;
          if (!this.hasMember(msg.roomId, msg.userId)) return;
          await this.handleGameStart(msg);
          return;
        case MessageType.CardPlayRequest:
          if (!isCardPlayRequestMessage(msg)) return;
          await this.handleCardPlayRequest(msg);
          return;
        default:
          this.broadcast(msg.roomId, JSON.stringify(msg));
          return;
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
