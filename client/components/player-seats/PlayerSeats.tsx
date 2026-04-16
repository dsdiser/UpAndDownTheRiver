import React, { useCallback, useContext, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import styles from './PlayerSeats.module.css';
import { roomMembersAtom, userAtom } from '../../state/userAtoms';
import type { RemoteMember } from '../../state/userAtoms';
import { Avatar } from '../avatar/Avatar';
import { GameState } from '../../types/gameState';
import {
  currentUserBetAtom,
  handSizeAtom,
  playerBetsAtom,
  playerHandSizesAtom,
  scoresAtom,
} from '../../state/gameAtoms';
import { gameStateAtom } from '../../state/gameStateAtom';
import { WebsocketContext } from '../../context/WebsocketContext';
import { MessageType } from '../../../types/messages';

interface PlayerSeatsProps {}

const PlayerSeats: React.FC<PlayerSeatsProps> = () => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerHandSizes = useAtomValue(playerHandSizesAtom);
  const playerBets = useAtomValue(playerBetsAtom);
  const scores = useAtomValue(scoresAtom);
  const currentUser = useAtomValue(userAtom);
  const gameState = useAtomValue(gameStateAtom);
  const currentUserBet = useAtomValue(currentUserBetAtom);
  const handSize = useAtomValue(handSizeAtom);
  const send = useContext(WebsocketContext);
  const setCurrentUserBet = useSetAtom(currentUserBetAtom);
  const currentUserId = currentUser?.id;
  const isBettingPhase = gameState === GameState.Betting;

  const onBetChange = useCallback(
    (newBet: number) => {
      const clampedBet = Math.max(0, Math.min(newBet, handSize));
      setCurrentUserBet(clampedBet);
    },
    [setCurrentUserBet, handSize]
  );

  const onBetSubmit = useCallback(() => {
    send({
      type: MessageType.BetPlaced,
      bet: currentUserBet,
    });
  }, [currentUserBet, send]);

  const activePlayers = useMemo(
    () => roomMembers.filter((member) => member.id in playerHandSizes),
    [roomMembers, playerHandSizes]
  );
  // Create lookup for member details by ID
  const memberMap = useMemo(() => {
    const map = new Map<string, RemoteMember>();
    activePlayers.forEach((m) => map.set(m.id, m));
    return map;
  }, [activePlayers]);

  // Render a single player seat
  const renderSeat = (seatNumber: number) => {
    // Find player assigned to this seat
    const playerId = activePlayers[seatNumber - 1]?.id ?? null;
    if (!playerId) return null;

    const isLocalPlayer = playerId === currentUserId;
    const member = memberMap.get(playerId);
    const seatHandSize = playerHandSizes[playerId] ?? 0;
    const bet = playerBets[playerId];
    const score = scores[playerId] ?? 0;
    const showBettingInput = isBettingPhase && isLocalPlayer && seatHandSize > 0;

    return (
      <div
        key={`seat-${seatNumber}`}
        className={`${styles.seat} ${showBettingInput ? styles.bettingSeat : ''}`}
        data-seat={seatNumber}
      >
        <div className={styles.avatarContainer}>
          <Avatar userId={playerId} avatar={member?.avatar} isSpeaking={false} />
        </div>

        <div className={styles.playerInfo}>
          <div className={styles.playerName}>{isLocalPlayer ? 'You' : `Player ${seatNumber}`}</div>
          {showBettingInput ? (
            <div className={styles.bettingInput}>
              <div className={styles.bettingPrompt}>How many hands?</div>
              <input
                type="number"
                className={styles.betNumberInput}
                min="0"
                max={seatHandSize}
                value={currentUserBet ?? ''}
                onChange={(e) => onBetChange(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <button
                className={styles.submitBetButton}
                onClick={onBetSubmit}
                disabled={currentUserBet === null || currentUserBet === undefined}
              >
                Submit
              </button>
            </div>
          ) : (
            <div className={styles.stats}>
              {seatHandSize > 0 && (
                <span className={styles.stat}>
                  {seatHandSize} card{seatHandSize !== 1 ? 's' : ''}
                </span>
              )}
              <span className={styles.stat}>Score: {score}</span>
              {bet !== null && bet !== undefined && <span className={styles.stat}>Bet: {bet}</span>}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.seatsContainer}>
      <div className={styles.seatsGrid}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((seatNumber) => renderSeat(seatNumber))}
      </div>

      {/* Central area - reserved for future use (cards, game info, etc) */}
      <div className={styles.center}>{/* Placeholder for central game area */}</div>
    </div>
  );
};

export default PlayerSeats;
