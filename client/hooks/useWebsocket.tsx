import { useEffect, useRef, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  pushIncomingAtom,
  IncomingMessage,
  OutgoingMessage,
  MessageType,
  FlipStartMessage,
  PresenceMessage,
} from '../state/websocketAtoms';
import { activeFlipperUserIdAtom, seedAtom, seedStore, startFlipAtom } from '../state/coinAtoms';
import { hc } from 'hono/client';
import { type appType } from '../../worker/main';
import { userAtom } from '../state/userAtoms';
import { type RemoteMember, roomMembersAtom } from '../state/userAtoms';
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
  const setStartFlip = useSetAtom(startFlipAtom);
  const setSeed = useSetAtom(seedAtom);
  const setPushIncoming = useSetAtom(pushIncomingAtom);
  const setRoomMembers = useSetAtom(roomMembersAtom);
  const setActiveFlipperUserId = useSetAtom(activeFlipperUserIdAtom);

  const handleMessage = useCallback(
    (parsedMessage: IncomingMessage) => {
      // Set specific atoms based on the message type, then push to specific atoms for handling
      // We can then use the atoms directly or use atomWithListeners to use a callback
      switch (parsedMessage.type) {
        case MessageType.Join:
          // No specific handling needed for Join messages currently
          break;
        case MessageType.Presence:
          const members = (parsedMessage as PresenceMessage).members as Array<RemoteMember>;
          setRoomMembers(members);
          break;
        case MessageType.FlipStart:
          let message = parsedMessage as FlipStartMessage;
          setSeed(message.seed);
          seedStore.set(seedAtom, message.seed);
          setActiveFlipperUserId(message.userId);
          setStartFlip(true);
          break;
        case MessageType.FlipResult:
          break;
        default:
          // Unknown type - still forward as an extensible message
          break;
      }
      setPushIncoming(parsedMessage);
    },
    [setPushIncoming, setStartFlip]
  );

  const connectWebsocket = useCallback(() => {
    const client = hc<appType>(websocketUrl);
    // Typing is weird here, but it works
    const ws: WebSocket = client.ws.initiate.$ws(0);
    console.log(ws);
    wsRef.current = ws;

    ws.onopen = () => {
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

    ws.onclose = (shouldRetry: boolean = true) => {
      // noop for now
      console.debug('Websocket closed.');
      // ws.close();
      if (shouldRetry) {
        setTimeout(() => {
          connectWebsocket();
        }, reconnectInterval);
        reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval); // Exponential backoff
      }
    };

    return () => {
      try {
        ws.close(false);
      } catch (e) {}
      wsRef.current = null;
    };
  }, [roomId, setPushIncoming]);

  useEffect(() => {
    const disconnect = connectWebsocket();

    return () => {
      disconnect();
    };
  }, [connectWebsocket]);

  const send = useCallback((message: OutgoingMessage) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.warn('Websocket not open, cannot send');
      return;
    }
    if (!user) {
      console.warn('No user, cannot send message');
      return;
    }
    if (message.type === MessageType.Join) {
      message.avatar = user.avatar;
    }
    message.id = createMessageId();
    message.userId = user.id;
    message.roomId = roomId;
    message.timestamp = Date.now();
    const stringifiedMessage = JSON.stringify(message);
    wsRef.current?.send(stringifiedMessage);
  }, []);

  return { send, connectionStatus: wsRef.current?.readyState || WebSocket.CLOSED };
}

export default useWebsocket;
