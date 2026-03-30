import type { GameState } from '../client/types/gameState';

export enum MessageType {
  Join = 'join',
  GameStart = 'game:start',
  GameStateSync = 'game:state:sync',
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
  playerHands?: Record<string, CardFace[]>;
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
  | CardPlayRequestMessage
  | CardPlayedMessage
  | TurnUpdateMessage
  | GameEndMessage
  | PresenceMessage
  | ({ type: string } & Record<string, unknown>);

export type OutgoingMessage = IncomingMessage | ({ type: string } & Record<string, unknown>);
