import { atom } from 'jotai';
import type { IncomingMessage } from '../../types/messages';

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
