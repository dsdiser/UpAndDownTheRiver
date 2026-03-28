import { atom } from 'jotai';
import { RemoteMember } from './userAtoms';

export enum MessageType {
  Join = 'join',
  GameStart = 'game:start',
  GameEnd = 'game:end',
  Presence = 'presence',
}

// Base message structure
interface BaseMessage {
  type: MessageType;
  userId: string; // ID of the user sending the message
  roomId?: string; // This is optional to allow clients to craft messages easier, but useWebsocket will always set it
  timestamp?: number;
  id: string;
}

// Specific message shapes
export interface JoinMessage extends BaseMessage {
  type: MessageType.Join;
  avatar?: string;
  roomMembers?: string[]; // Should be fulfilled by server
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
    result: string; // 'heads' | 'tails' etc. Keep generic string for now
    seed?: number;
  };
}

export type IncomingMessage =
  | JoinMessage
  | GameStartMessage
  | GameEndMessage
  | PresenceMessage
  | ({ type: string } & Record<string, unknown>);

export type OutgoingMessage = IncomingMessage | ({ type: string } & Record<string, unknown>);

// Base incoming raw message atom (last parsed incoming message)
export const incomingMessageAtom = atom<IncomingMessage | null>(null);

// Message history atom - append every incoming message (keeps small history)
export const messageHistoryAtom = atom<IncomingMessage[]>([]);

// Derived atom: last message
export const lastMessageAtom = atom<IncomingMessage | null>((get) => {
  const history = get(messageHistoryAtom);
  return history.length ? history[history.length - 1] : null;
});

// A small utility write-only atom to push an incoming message into history and set incoming
export const pushIncomingAtom = atom(null, (get, set, incoming: IncomingMessage) => {
  set(incomingMessageAtom, incoming);
  const prev = get(messageHistoryAtom);
  // keep last 20 messages
  set(messageHistoryAtom, [...prev, incoming].slice(-20));
});
