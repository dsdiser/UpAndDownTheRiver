import { WebSocket } from '@cloudflare/workers-types';
import { WSContext } from 'hono/ws';

export interface RoomMember {
  userId: string;
  avatar?: string;
  ws: WebSocket; // Cloudflare WebSocket
}

// Factory to create a new rooms map (roomId -> Set<RoomMember>)
export function createRoomsMap() {
  return new Map<string, Set<RoomMember>>();
}

// Pure helper: join a roomsMap
export function joinRoomToMap(
  roomsMap: Map<string, Set<RoomMember>>,
  roomId: string,
  userId: string,
  avatar: string | undefined,
  ws: WebSocket
) {
  if (!roomsMap.has(roomId)) {
    console.debug(`Creating new room ${roomId}`);
    roomsMap.set(roomId, new Set<RoomMember>());
  }
  roomsMap.get(roomId)!.add({ userId, ws, avatar });
  ws.serializeAttachment({ roomId, userId, avatar });
  // Broadcast presence to everyone in the room
  const presence = JSON.stringify({
    type: 'presence',
    roomId,
    members: Array.from(roomsMap.get(roomId)!).map((m) => ({ id: m.userId, avatar: m.avatar })),
  });
  broadcastToRoomInMap(roomsMap, roomId, presence);
  console.debug('Rooms:', roomsMap);
}

// Pure helper: leave by ws instance
export function leaveRoomFromMap(roomsMap: Map<string, Set<RoomMember>>, ws: any) {
  for (const [roomId, members] of roomsMap.entries()) {
    for (const member of members) {
      if (member.ws === ws) {
        members.delete(member);
        // Broadcast updated presence to remaining members
        const presenceMsg = JSON.stringify({
          type: 'presence',
          roomId,
          members: Array.from(members).map((m) => ({ id: m.userId, avatar: m.avatar })),
        });
        broadcastToRoomInMap(roomsMap, roomId, presenceMsg);
        if (members.size === 0) roomsMap.delete(roomId);
        return;
      }
    }
  }
}

// Pure helper: broadcast into a roomsMap
export function broadcastToRoomInMap(
  roomsMap: Map<string, Set<RoomMember>>,
  roomId: string,
  data: any
) {
  const set = roomsMap.get(roomId);
  if (!set) return;
  for (const roomMember of Array.from(set)) {
    try {
      if (roomMember.ws && roomMember.ws.readyState === 1) {
        roomMember.ws.send(data);
      } else if (roomMember.ws && [2, 3].includes(roomMember.ws.readyState)) {
        // Closed or closing, remove from set
        set.delete(roomMember);
      }
    } catch (e) {
      // Remove broken socket
      set.delete(roomMember);
    }
  }
  if (set.size === 0) roomsMap.delete(roomId);
}

export function joinRoom(
  connections: Map<string, Set<RoomMember>>,
  roomId: string,
  userId: string,
  avatar: string | undefined,
  ws: WebSocket
) {
  return joinRoomToMap(connections, roomId, userId, avatar, ws);
}

export function leaveRoom(connections: Map<string, Set<RoomMember>>, ws: WebSocket) {
  return leaveRoomFromMap(connections, ws);
}

export function broadcastToRoom(
  connections: Map<string, Set<RoomMember>>,
  roomId: string,
  data: any
) {
  return broadcastToRoomInMap(connections, roomId, data);
}
