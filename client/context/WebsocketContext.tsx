import { createContext } from 'react';
import type { ClientOutgoingMessage } from '../../types/messages';

/**
 * Context for the websocket send function.
 * Provides a single shared websocket connection.
 *
 * The send function automatically fills in:
 * - userId: from current user context
 * - roomId: from websocket connection
 * - timestamp: current time
 * - id: unique message id
 */
export const WebsocketContext = createContext<(message: ClientOutgoingMessage) => void>(() => {
  console.warn('WebsocketContext send function called before initialization');
});
