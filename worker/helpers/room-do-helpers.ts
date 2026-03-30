import { WebSocket } from '@cloudflare/workers-types';
import { allPlayingCards } from '../../client/types/cards';
import { MessageType } from '../../types/messages';
import type {
  CardFace,
  PlayedCard,
  JoinMessage,
  CardPlayRequestMessage,
  GameStateSyncMessage,
  CardPlayedMessage,
  GameStartMessage,
} from '../../types/messages';
import { GameState } from '../../client/types/gameState';
import { MersenneTwister19937, shuffle } from 'random-js';

export interface RoomMember {
  userId: string;
  avatar?: string;
  ws: WebSocket;
}

export type RoomGameState = {
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

export function gameStateKey(roomId: string) {
  return `${GAME_STATE_KEY_PREFIX}${roomId}`;
}

type AnyRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isJoinMessage(value: unknown): value is JoinMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.Join &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isString(value.id) &&
    (value.avatar === undefined || isString(value.avatar))
  );
}

export function isGameStartMessage(value: unknown): value is GameStartMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.GameStart &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isNumber(value.seed) &&
    isString(value.id)
  );
}

export function isCardPlayRequestMessage(value: unknown): value is CardPlayRequestMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.CardPlayRequest &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isString(value.card) &&
    isString(value.id)
  );
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const engine = MersenneTwister19937.seed(seed);
  return shuffle(engine, [...items]);
}

export function buildInitialGameState(
  roomId: string,
  seed: number,
  members: Array<{ id: string; avatar?: string }>
): RoomGameState {
  const cardDeck = allPlayingCards.map((card) => card.face);
  const shuffledDeck = seededShuffle(cardDeck, seed);
  const turnOrder = members.map((member) => member.id);
  const maxHandSize = Math.min(10, Math.floor(shuffledDeck.length / Math.max(turnOrder.length, 1)));
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
    sortedDeck: cardDeck,
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

export function buildGameStateSyncMessage(
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

export function buildCardPlayedMessage(
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
