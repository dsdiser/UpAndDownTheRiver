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
  BetPlacedMessage,
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
  playerBets: Record<string, number | null>;
  lastUpdated: number;
};

export const GAME_STATE_KEY_PREFIX = 'gameState:';

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

export function isBetPlacedMessage(value: unknown): value is BetPlacedMessage {
  return (
    isRecord(value) &&
    value.type === MessageType.BetPlaced &&
    isString(value.userId) &&
    isString(value.roomId) &&
    isNumber(value.bet) &&
    isString(value.id)
  );
}

export function seededShuffle<T>(items: T[], seed: number): T[] {
  const engine = MersenneTwister19937.seed(seed);
  return shuffle(engine, [...items]);
}

/**
 * Deal cards from a pile to players and determine trump card.
 * Returns player hands, remaining draw pile (excluding trump), and trump card.
 */
function dealCardsFromPile(
  cardPile: CardFace[],
  playerIds: string[],
  handSize: number
): {
  playerHands: Record<string, CardFace[]>;
  drawPile: CardFace[];
  trumpCard: CardFace | null;
} {
  const playerHands: Record<string, CardFace[]> = {};
  let cardIndex = 0;

  // Deal cards to each player
  for (const playerId of playerIds) {
    const cardsForPlayer: CardFace[] = [];
    for (let i = 0; i < handSize; i++) {
      if (cardIndex < cardPile.length) {
        cardsForPlayer.push(cardPile[cardIndex]);
        cardIndex++;
      }
    }
    playerHands[playerId] = cardsForPlayer;
  }

  // Remaining cards become the draw pile
  const remainingPile = cardPile.slice(cardIndex);
  const trumpCard = remainingPile.length > 0 ? remainingPile[0] : null;
  const drawPile = trumpCard ? remainingPile.slice(1) : remainingPile;

  return { playerHands, drawPile, trumpCard };
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

  // Deal initial cards
  const { playerHands, drawPile, trumpCard } = dealCardsFromPile(shuffledDeck, turnOrder, handSize);

  // Initialize playerBets with all players having null (not yet placed)
  const playerBets: Record<string, number | null> = {};
  for (const playerId of turnOrder) {
    playerBets[playerId] = null;
  }

  return {
    phase: GameState.Betting,
    seed,
    roundNumber: 1,
    handSize,
    roundDirection: 'up',
    maxHandSize,
    trumpCard,
    sortedDeck: cardDeck,
    shuffledDeck,
    drawPile,
    playerHands,
    playedCards: [],
    currentTrick: [],
    turnOrder,
    activePlayerId: turnOrder.length > 0 ? turnOrder[0] : null,
    scores: turnOrder.reduce<Record<string, number>>((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {}),
    playerBets,
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
    playerBets: gameState.playerBets,
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

export function buildBetPlacedMessage(
  roomId: string,
  userId: string,
  bet: number,
  playerBets: Record<string, number | null>,
  allBetsPlaced?: boolean
): BetPlacedMessage {
  return {
    type: MessageType.BetPlaced,
    userId,
    roomId,
    id: `${roomId}:${Date.now()}`,
    timestamp: Date.now(),
    bet,
    playerBets,
    allBetsPlaced,
  };
}

/**
 * Check if a round is complete (all players have played all their cards)
 */
export function isRoundComplete(gameState: RoomGameState): boolean {
  return Object.values(gameState.playerHands).every((hand) => hand.length === 0);
}

/**
 * Deal cards for the next round, automatically handling direction changes.
 * - If going UP and hand size < max: increase hand size
 * - If going UP and hand size == max: switch to DOWN, decrease hand size
 * - If going DOWN and hand size > 1: decrease hand size
 * - If going DOWN and hand size == 1: game ends (returns null)
 * 
 * Also updates turnOrder to include any new players who joined mid-game.
 */
export function dealCardsForRound(
  gameState: RoomGameState,
  currentMembers?: Array<{ id: string; avatar?: string }>
): RoomGameState | null {
  let newHandSize = gameState.handSize;
  let newDirection = gameState.roundDirection;

  // Update turnOrder to include any new players who joined mid-game
  let updatedTurnOrder = gameState.turnOrder;
  if (currentMembers) {
    const currentMemberIds = new Set(currentMembers.map((m) => m.id));
    const newPlayers = currentMembers.filter((m) => !gameState.turnOrder.includes(m.id));

    if (newPlayers.length > 0) {
      // Keep existing players in their current order, append new players
      updatedTurnOrder = [
        ...gameState.turnOrder.filter((id) => currentMemberIds.has(id)),
        ...newPlayers.map((p) => p.id),
      ];
    }
  }

  if (gameState.roundDirection === 'up') {
    if (gameState.handSize < gameState.maxHandSize) {
      newHandSize = gameState.handSize + 1;
    } else {
      // Reached max, switch to going down
      newDirection = 'down';
      newHandSize = gameState.maxHandSize - 1;
    }
  } else {
    // roundDirection === 'down'
    if (gameState.handSize > 1) {
      newHandSize = gameState.handSize - 1;
    } else {
      // Hand size is 1 and going down - game is complete
      return null;
    }
  }

  // Deal cards from the draw pile
  const cardsNeeded = updatedTurnOrder.length * newHandSize;
  if (gameState.drawPile.length < cardsNeeded) {
    console.warn(
      `Not enough cards in draw pile to deal. Available: ${gameState.drawPile.length}, needed: ${cardsNeeded}`
    );
  }

  const {
    playerHands: newPlayerHands,
    drawPile: newDrawPile,
    trumpCard: newTrumpCard,
  } = dealCardsFromPile(gameState.drawPile, updatedTurnOrder, newHandSize);

  // Reset bets for new round and initialize new players
  const newPlayerBets: Record<string, number | null> = {};
  for (const playerId of updatedTurnOrder) {
    newPlayerBets[playerId] = null;
  }

  // Initialize scores for new players
  const newScores = { ...gameState.scores };
  for (const playerId of updatedTurnOrder) {
    if (!(playerId in newScores)) {
      newScores[playerId] = 0;
    }
  }

  return {
    ...gameState,
    phase: GameState.Betting,
    roundNumber: gameState.roundNumber + 1,
    handSize: newHandSize,
    roundDirection: newDirection,
    trumpCard: newTrumpCard,
    drawPile: newDrawPile,
    playerHands: newPlayerHands,
    playedCards: [], // Clear played cards for new round
    currentTrick: [], // Clear current trick
    turnOrder: updatedTurnOrder, // Update turnOrder to include new players
    activePlayerId: updatedTurnOrder.length > 0 ? updatedTurnOrder[0] : null, // Reset to first player
    scores: newScores,
    playerBets: newPlayerBets,
    lastUpdated: Date.now(),
  };
}
