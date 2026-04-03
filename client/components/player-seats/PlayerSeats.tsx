import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import styles from './PlayerSeats.module.css';
import { userAtom } from '../../state/userAtoms';
import type { RemoteMember } from '../../state/userAtoms';
import { Avatar } from '../avatar/Avatar';

interface PlayerSeatsProps {
  roomMembers: RemoteMember[];
  playerHandSizes: Record<string, number>;
  playerBets: Record<string, number | null>;
  scores: Record<string, number>;
}

// Maps number of players to which seat indices to display
const ACTIVE_SEATS_BY_PLAYER_COUNT: Record<number, number[]> = {
  1: [5], // Local player only
  2: [1, 5], // Top & bottom
  3: [1, 3, 5], // Top, right, bottom
  4: [1, 3, 5, 7], // Top, right, bottom, left (cardinal directions)
  5: [1, 2, 5, 6, 7], // Cardinals + 2 diagonals on bottom half
  6: [1, 2, 3, 5, 6, 7], // All cardinal + 2 adjacent diagonals
  7: [1, 2, 3, 4, 5, 6, 7], // All but one diagonal
  8: [1, 2, 3, 4, 5, 6, 7, 8], // All seats
};

// Determine which seats to display based on player count
const getActiveSeats = (playerCount: number): number[] => {
  if (playerCount < 1) return [];
  if (playerCount > 8) return ACTIVE_SEATS_BY_PLAYER_COUNT[8];
  return ACTIVE_SEATS_BY_PLAYER_COUNT[playerCount];
};

// Map player indices to seat numbers, with local player always at seat 5 (bottom-center)
const mapPlayersToSeats = (
  roomMembers: RemoteMember[],
  currentUserId: string | undefined,
  activeSeats: number[]
): Map<string, number> => {
  const playerToSeat = new Map<string, number>();

  if (!currentUserId) return playerToSeat;

  // Always place local player at seat 5 (bottom-center)
  playerToSeat.set(currentUserId, 5);

  // Get other players (non-local)
  const otherPlayers = roomMembers.filter((m) => m.id !== currentUserId);

  // Distribute other players across available seats (excluding seat 5)
  const availableSeats = activeSeats.filter((s) => s !== 5);

  otherPlayers.forEach((player, idx) => {
    if (idx < availableSeats.length) {
      playerToSeat.set(player.id, availableSeats[idx]);
    }
  });

  return playerToSeat;
};

const PlayerSeats: React.FC<PlayerSeatsProps> = ({
  roomMembers,
  playerHandSizes,
  playerBets,
  scores,
}) => {
  const currentUser = useAtomValue(userAtom);
  const currentUserId = currentUser?.id;

  // Determine active seats and player-to-seat mapping
  const allPlayers = useMemo(() => {
    return currentUserId
      ? [currentUserId, ...roomMembers.map((m) => m.id).filter((id) => id !== currentUserId)]
      : roomMembers.map((m) => m.id);
  }, [currentUserId, roomMembers]);

  const activeSeats = useMemo(() => getActiveSeats(allPlayers.length), [allPlayers.length]);

  const playerToSeat = useMemo(
    () => mapPlayersToSeats(roomMembers, currentUserId, activeSeats),
    [roomMembers, currentUserId, activeSeats]
  );

  // Create lookup for member details by ID
  const memberMap = useMemo(() => {
    const map = new Map<string, RemoteMember>();
    roomMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [roomMembers]);

  // Render a single player seat
  const renderSeat = (seatNumber: number) => {
    // Find player assigned to this seat
    const playerId = Array.from(playerToSeat.entries()).find(
      ([, seat]) => seat === seatNumber
    )?.[0];

    if (!playerId) return null;

    const isLocalPlayer = playerId === currentUserId;
    const member = memberMap.get(playerId);
    const handSize = playerHandSizes[playerId] ?? 0;
    const bet = playerBets[playerId];
    const score = scores[playerId] ?? 0;
    const isWaitingPlayer = !(playerId in playerHandSizes);

    return (
      <div
        key={`seat-${seatNumber}`}
        className={`${styles.seat} ${isWaitingPlayer ? styles.waiting : ''}`}
        data-seat={seatNumber}
      >
        <div className={styles.avatarContainer}>
          <Avatar userId={playerId} avatar={member?.avatar} isSpeaking={false} />
        </div>

        <div className={styles.playerInfo}>
          <div className={styles.playerName}>{isLocalPlayer ? 'You' : `Player ${seatNumber}`}</div>

          <div className={styles.stats}>
            {handSize > 0 && (
              <span className={styles.stat}>
                {handSize} card{handSize !== 1 ? 's' : ''}
              </span>
            )}
            <span className={styles.stat}>Score: {score}</span>
            {bet !== null && bet !== undefined && <span className={styles.stat}>Bet: {bet}</span>}
          </div>
        </div>

        {isWaitingPlayer && <div className={styles.waitingBadge}>Waiting</div>}
      </div>
    );
  };

  return (
    <div className={styles.seatsContainer}>
      <div className={styles.seatsGrid}>{activeSeats.map((seatNum) => renderSeat(seatNum))}</div>

      {/* Central area - reserved for future use (cards, game info, etc) */}
      <div className={styles.center}>{/* Placeholder for central game area */}</div>
    </div>
  );
};

export default PlayerSeats;
