import React, { useCallback, useContext } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import styles from './BettingScreen.module.css';
import {
  playerBetsAtom,
  currentUserBetAtom,
  handSizeAtom,
  trumpCardAtom,
  playerHandAtom,
} from '../../state/gameAtoms';
import { roomMembersAtom, userAtom } from '../../state/userAtoms';
import { WebsocketContext } from '../../context/WebsocketContext';
import { MessageType } from '../../../types/messages';
import Card from '../card/Card';
import type { CardFace } from '../../types/cards';

export const BettingScreen: React.FC = () => {
  const user = useAtomValue(userAtom);
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerBets = useAtomValue(playerBetsAtom);
  const currentUserBet = useAtomValue(currentUserBetAtom);
  const handSize = useAtomValue(handSizeAtom);
  const trumpCard = useAtomValue(trumpCardAtom);
  const playerHand = useAtomValue(playerHandAtom);
  const setCurrentUserBet = useSetAtom(currentUserBetAtom);
  const send = useContext(WebsocketContext);

  const handleBetChange = useCallback(
    (newBet: number) => {
      // Clamp bet between 0 and handSize
      const clampedBet = Math.max(0, Math.min(newBet, handSize));
      setCurrentUserBet(clampedBet);
    },
    [setCurrentUserBet, handSize]
  );

  const handleSubmitBet = useCallback(() => {
    send({
      type: MessageType.BetPlaced,
      bet: currentUserBet,
    });
  }, [currentUserBet, send]);

  const allBetsPlaced = React.useMemo(() => {
    return roomMembers.every(
      (member) => playerBets[member.id] !== undefined && playerBets[member.id] !== null
    );
  }, [roomMembers, playerBets]);

  return (
    <div className={styles.bettingScreen}>
      <div className={styles.content}>
        <h2 className={styles.title}>Place Your Bet</h2>

        {trumpCard && (
          <div className={styles.trumpCard}>
            <p className={styles.trumpLabel}>Trump Card:</p>
            <p className={styles.trumpValue}>{trumpCard}</p>
          </div>
        )}

        <div className={styles.handDisplay}>
          <h3 className={styles.handTitle}>Your Hand:</h3>
          <div className={styles.cardGrid}>
            {playerHand.map((cardFace) => (
              <Card
                key={cardFace}
                cardFace={cardFace as CardFace}
                imagePath={`/images/cards/card_${cardFace}.png`}
                canPlay={false}
                disabledReason="Select your bet first"
                onPlay={() => {}}
              />
            ))}
          </div>
        </div>

        <div className={styles.betSection}>
          <p className={styles.handSizeInfo}>Hand Size: {handSize} cards</p>
          <p className={styles.betPrompt}>How many hands will you win? (0-{handSize})</p>

          <div className={styles.betInputContainer}>
            <input
              type="number"
              className={styles.betInput}
              min="0"
              max={handSize}
              value={currentUserBet ?? ''}
              onChange={(e) => handleBetChange(parseInt(e.target.value) || 0)}
              placeholder="Enter your bet"
            />
          </div>

          <button
            className={styles.submitButton}
            onClick={handleSubmitBet}
            disabled={currentUserBet === null}
          >
            Submit Bet
          </button>
        </div>

        <div className={styles.playerBets}>
          <h3 className={styles.playerBetsTitle}>Players' Bets:</h3>
          <ul className={styles.betsList}>
            {roomMembers.map((member) => (
              <li key={member.id} className={styles.betItem}>
                <span className={styles.playerName}>
                  {member.id === user?.id ? 'You' : member.id}
                </span>
                <span className={styles.betStatus}>
                  {playerBets[member.id] !== null && playerBets[member.id] !== undefined
                    ? `Bet: ${playerBets[member.id]}`
                    : 'Waiting for bet...'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {allBetsPlaced && (
          <div className={styles.waitingForPlay}>
            <p className={styles.readyMessage}>All bets placed! Game starting...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BettingScreen;
