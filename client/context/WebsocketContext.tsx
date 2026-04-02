import { createContext } from 'react';
import type { OutgoingMessage } from '../../types/messages';

/**
 * Context for the websocket send function.
 * Provides a single shared websocket connection
 */
export const WebsocketContext = createContext<(message: OutgoingMessage) => void>(() => {
  console.warn('WebsocketContext send function called before initialization');
});
