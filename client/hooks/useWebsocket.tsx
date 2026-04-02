import { useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { pushIncomingAtom } from '../state/websocketAtoms';
import {
  IncomingMessage,
  OutgoingMessage,
  MessageType,
  PresenceMessage,
  GameStateSyncMessage,
  CardPlayedMessage,
  TurnUpdateMessage,
} from '../../types/messages';
import { gameStateAtom } from '../state/gameStateAtom';
import { GameState } from '../types/gameState';
import { hc } from 'hono/client';
import { type appType } from '../../worker/main';
import { userAtom } from '../state/userAtoms';
import { type RemoteMember, roomMembersAtom } from '../state/userAtoms';
import {
  activePlayerIdAtom,
  playerHandAtom,
  playerHandSizesAtom,
  playedCardsAtom,
  currentTrickAtom,
  scoresAtom,
  trumpCardAtom,
} from '../state/gameAtoms';
import { getProxiedUrl } from '../utils/url-proxy';

function createMessageId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const websocketUrl = getProxiedUrl(window.location.origin);
let reconnectInterval = 1000; // Initial delay in milliseconds
const maxReconnectInterval = 30000; // Maximum delay in milliseconds

export function useWebsocket(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const user = useAtomValue(userAtom);
  const setPushIncoming = useSetAtom(pushIncomingAtom);
  const setRoomMembers = useSetAtom(roomMembersAtom);
  const setGameState = useSetAtom(gameStateAtom);
  const setActivePlayerId = useSetAtom(activePlayerIdAtom);
  const setPlayerHand = useSetAtom(playerHandAtom);
  const setPlayerHandSizes = useSetAtom(playerHandSizesAtom);
  const setPlayedCards = useSetAtom(playedCardsAtom);
  const setCurrentTrick = useSetAtom(currentTrickAtom);
  const setScores = useSetAtom(scoresAtom);
  const setTrumpCard = useSetAtom(trumpCardAtom);

  // High level approach here:
  // Websocket message comes in, a specific handler is invoked and updates relevant atoms.
  // Each component that uses those atoms gets rerendered with that state.
  const handleMessage = useCallback(
    (parsedMessage: IncomingMessage) => {
      // Set specific atoms based on the message type, then push to specific atoms for handling
      // We can then use the atoms directly or use atomWithListeners to use a callback
      switch (parsedMessage.type) {
        case MessageType.Presence:
          const members = (parsedMessage as PresenceMessage).members as Array<RemoteMember>;
          setRoomMembers(members);
          break;
        case MessageType.GameStart:
          // const startMessage = parsedMessage as GameStartMessage;
          setGameState(GameState.DealingCards);
          break;
        case MessageType.GameStateSync:
          const syncMessage = parsedMessage as GameStateSyncMessage;
          setGameState(syncMessage.phase);
          setActivePlayerId(syncMessage.activePlayerId);
          setPlayerHandSizes(syncMessage.playerHandSizes);
          setPlayedCards(syncMessage.playedCards);
          setCurrentTrick(syncMessage.trick);
          setScores(syncMessage.scores);
          setTrumpCard(syncMessage.trumpCard);
          if (syncMessage.playerHands && user) {
            setPlayerHand(syncMessage.playerHands[user.id] ?? []);
          }
          break;
        case MessageType.CardPlayed:
          const playedMessage = parsedMessage as CardPlayedMessage;
          setPlayedCards((prev) => [
            ...prev,
            {
              userId: playedMessage.userId,
              card: playedMessage.card,
              timestamp: playedMessage.timestamp ?? Date.now(),
            },
          ]);
          setCurrentTrick(playedMessage.trick);
          if (playedMessage.activePlayerId !== null) {
            setActivePlayerId(playedMessage.activePlayerId);
          }
          if (user?.id === playedMessage.userId) {
            setPlayerHand((prev) => {
              const index = prev.indexOf(playedMessage.card);
              if (index === -1) return prev;
              return [...prev.slice(0, index), ...prev.slice(index + 1)];
            });
          }
          break;
        case MessageType.TurnUpdate:
          const turnMessage = parsedMessage as TurnUpdateMessage;
          setActivePlayerId(turnMessage.userId);
          setCurrentTrick(turnMessage.trick);
          break;
        case MessageType.GameEnd:
          break;
        case MessageType.Join:
          break;
      }
      setPushIncoming(parsedMessage);
    },
    [
      setPushIncoming,
      setRoomMembers,
      setGameState,
      setActivePlayerId,
      setPlayerHand,
      setPlayerHandSizes,
      setPlayedCards,
      setCurrentTrick,
      setScores,
      setTrumpCard,
      user,
    ]
  );

  const connectWebsocket = useCallback(() => {
    const client = hc<appType>(websocketUrl);
    // Typing is weird here, but it works
    const ws: WebSocket = (client.ws.initiate as any).$ws(0);
    wsRef.current = ws;

    ws.onopen = () => {
      // This will either join an existing unstarted room or a started room
      // If we join a started room we should expect a GameStateSync message that will get handled above
      send({ type: MessageType.Join, roomId });
    };

    ws.onmessage = (evt: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(evt.data) as IncomingMessage;
        console.debug('Received websocket message', parsed);
        // Basic validation: must have type
        if (!parsed || typeof parsed.type !== 'string') {
          console.warn('Malformed incoming message (missing type)', parsed);
          return;
        }
        handleMessage(parsed);
      } catch (err) {
        console.warn('Failed to parse websocket message', err);
      }
    };

    ws.onerror = (err: any) => {
      console.warn('Websocket error', err);
    };

    ws.onclose = (e: CloseEvent) => {
      // noop for now
      console.debug('Websocket closed.');
      // ws.close();
      if (e.reason === 'retry') {
        setTimeout(() => {
          connectWebsocket();
        }, reconnectInterval);
        reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval); // Exponential backoff
      }
    };

    return () => {
      try {
        ws.close(1000, 'retry');
      } catch (e) {}
      wsRef.current = null;
    };
  }, [roomId, handleMessage]);

  useEffect(() => {
    const disconnect = connectWebsocket();

    return () => {
      disconnect();
    };
  }, [connectWebsocket]);

  const send = useCallback(
    (message: OutgoingMessage) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        console.warn('Websocket not open, cannot send');
        return;
      }
      if (!user) {
        console.warn('No user, cannot send message');
        return;
      }

      const outgoingMessage = { ...message } as OutgoingMessage;
      if (outgoingMessage.type === MessageType.Join) {
        outgoingMessage.avatar = user.avatar;
      }
      outgoingMessage.id = createMessageId();
      outgoingMessage.userId = user.id;
      outgoingMessage.roomId = roomId;
      outgoingMessage.timestamp = Date.now();
      const stringifiedMessage = JSON.stringify(outgoingMessage);
      console.debug('Sending websocket message', outgoingMessage);
      wsRef.current?.send(stringifiedMessage);
    },
    [user, roomId]
  );

  return { send, connectionStatus: wsRef.current?.readyState || WebSocket.CLOSED };
}

export default useWebsocket;
