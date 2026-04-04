import type { GameState } from '../client/types/gameState';

export enum MessageType {
  Join = 'join',
  GameStart = 'game:start',
  GameStateSync = 'game:state:sync',
  BetPlaced = 'bet:placed',
  BettingComplete = 'betting:complete',
  CardPlayRequest = 'card:play:request',
  CardPlayed = 'card:played',
  TurnUpdate = 'game:turn:update',
  GameEnd = 'game:end',
  Presence = 'presence',
}

export type CardFace = string;

export type RemoteMember = {
  id: string;
  avatar?: string;
};

export interface BaseMessage {
  type: MessageType;
  userId: string;
  roomId: string;
  timestamp?: number;
  id: string;
}

export interface JoinMessage extends BaseMessage {
  type: MessageType.Join;
  avatar?: string;
  roomMembers?: string[];
}

export interface GameStartMessage extends BaseMessage {
  type: MessageType.GameStart;
  seed: number;
}

export interface PresenceMessage extends BaseMessage {
  type: MessageType.Presence;
  members: Array<RemoteMember>;
}

export interface GameEndMessage extends BaseMessage {
  type: MessageType.GameEnd;
  payload: {
    result: string;
    seed?: number;
  };
}

export type PlayedCard = {
  userId: string;
  card: CardFace;
  timestamp: number;
};

export interface GameStateSyncMessage extends BaseMessage {
  type: MessageType.GameStateSync;
  phase: GameState;
  roundNumber: number;
  handSize: number;
  roundDirection: 'up' | 'down';
  maxHandSize: number;
  trumpCard: CardFace | null;
  activePlayerId: string | null;
  turnOrder: string[];
  trick: PlayedCard[];
  playedCards: PlayedCard[];
  playerHandSizes: Record<string, number>;
  scores: Record<string, number>;
  playerBets?: Record<string, number | null>;
  playerHands?: Record<string, CardFace[]>;
}

export interface BetPlacedMessage extends BaseMessage {
  type: MessageType.BetPlaced;
  bet: number;
  playerBets: Record<string, number | null>;
  allBetsPlaced?: boolean;
}

export interface BettingCompleteMessage extends BaseMessage {
  type: MessageType.BettingComplete;
  playerBets: Record<string, number>;
  activePlayerId: string | null;
}

export interface CardPlayRequestMessage extends BaseMessage {
  type: MessageType.CardPlayRequest;
  card: CardFace;
}

export interface CardPlayedMessage extends BaseMessage {
  type: MessageType.CardPlayed;
  card: CardFace;
  activePlayerId: string | null;
  trick: PlayedCard[];
  remainingHandCount: number;
}

export interface TurnUpdateMessage extends BaseMessage {
  type: MessageType.TurnUpdate;
  turnOrder: string[];
  trick: PlayedCard[];
}

export type IncomingMessage =
  | JoinMessage
  | GameStartMessage
  | GameStateSyncMessage
  | BetPlacedMessage
  | BettingCompleteMessage
  | CardPlayRequestMessage
  | CardPlayedMessage
  | TurnUpdateMessage
  | GameEndMessage
  | PresenceMessage;

export type OutgoingMessage = IncomingMessage | ({ type: string } & Record<string, unknown>);

/**
 * Client-side message types - userId, roomId, timestamp, and id are automatically added by send function
 */
export interface ClientJoinMessage {
  type: MessageType.Join;
  avatar?: string;
  roomMembers?: string[];
}

export interface ClientBetPlacedMessage {
  type: MessageType.BetPlaced;
  bet: number;
}

export interface ClientCardPlayRequestMessage {
  type: MessageType.CardPlayRequest;
  card: CardFace;
}

export type ClientOutgoingMessage =
  | ClientJoinMessage
  | ClientBetPlacedMessage
  | ClientCardPlayRequestMessage
  | ({ type: string } & Record<string, unknown>);
