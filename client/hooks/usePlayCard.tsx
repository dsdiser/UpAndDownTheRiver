import { useCallback, useContext } from 'react';
import { useAtomValue } from 'jotai';
import { userAtom } from '../state/userAtoms';
import { WebsocketContext } from '../context/WebsocketContext';
import type { CardFace } from '../types/cards';
import { MessageType } from '../../types/messages';

/**
 * Hook to handle playing a card
 *
 * Sends CardPlayRequest message to server via the shared websocket connection
 * (provided by WebsocketContext to avoid creating duplicate connections)
 */
export const usePlayCard = () => {
  const user = useAtomValue(userAtom);
  const send = useContext(WebsocketContext);

  const playCard = useCallback(
    (cardFace: CardFace) => {
      if (!user) {
        console.warn('Cannot play card: no user');
        return false;
      }

      if (!send) {
        console.warn('Websocket not connected');
        return false;
      }

      try {
        // Send card play request to server using the shared websocket connection
        send({
          type: MessageType.CardPlayRequest,
          card: cardFace,
        });

        // If we get here, message was sent successfully
        // The server will respond with CardPlayed message which updates atoms
        return true;
      } catch (error) {
        console.error('Failed to play card:', error);
        return false;
      }
    },
    [user, send]
  );

  return playCard;
};

export default usePlayCard;
