import React, { useState, useMemo, useCallback, useContext } from 'react';
import { useAtomValue } from 'jotai';
import styles from './Hand.module.css';
import { Card } from '../card/Card';
import {
  playerHandAtom,
  activePlayerIdAtom,
  currentTrickAtom,
  trumpCardAtom,
} from '../../state/gameAtoms';
import { userAtom } from '../../state/userAtoms';
import type { CardFace } from '../../types/cards';
import { allPlayingCards } from '../../types/cards';
import { WebsocketContext } from '../../context/WebsocketContext';
import { MessageType } from '../../../types/messages';
import { gameStateAtom } from '../../state/gameStateAtom';
import { GameState } from '../../types/gameState';

const ranks = ['02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K', 'A'];
const suits = ['clubs', 'diamonds', 'hearts', 'spades'];

interface CardPlayableStatus {
  card: CardFace;
  canPlay: boolean;
  reason?: string;
}

/**
 * Hand component - displays current player's hand with suit and rank-based sorting.
 *
 * Features:
 * - Sorted by suit (clubs → diamonds → hearts → spades), then by rank (high to low)
 * - Validate playable cards based on suit-following rules
 * - Disable cards when it's not the player's turn
 * - Show disable reasons in tooltips
 */
export const Hand: React.FC = () => {
  const user = useAtomValue(userAtom);
  const playerHand = useAtomValue(playerHandAtom);
  const activePlayerId = useAtomValue(activePlayerIdAtom);
  const currentTrick = useAtomValue(currentTrickAtom);
  const trumpCard = useAtomValue(trumpCardAtom);
  const send = useContext(WebsocketContext);
  const gameState = useAtomValue(gameStateAtom);

  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

  const isMyTurn = user?.id === activePlayerId;

  /**
   * Helper to extract played card info
   */
  const getLedSuit = useCallback(() => {
    if (currentTrick.length === 0) return null;
    const firstCard = currentTrick[0].card;
    // Extract suit from CardFace (format: "suit_rank")
    const suit = firstCard.split('_')[0]; // e.g., "hearts" from "hearts_K"
    return suit;
  }, [currentTrick]);

  const playCard = useCallback(
    (cardFace: CardFace) => {
      send({
        type: MessageType.CardPlayRequest,
        card: cardFace,
      });
    },
    [send]
  );

  /**
   * Get the rank sorting order
   */
  const getRankOrder = (card: CardFace): number => {
    const rank = card.split('_')[1];
    return ranks.indexOf(rank as string);
  };

  /**
   * Get the suit sorting order
   */
  const getSuitOrder = (card: CardFace): number => {
    const suit = card.split('_')[0];
    return suits.indexOf(suit as string);
  };

  /**
   * Determine if a card can be played based on suit-following rules
   */
  const getPlayableStatusForCard = useCallback(
    (card: CardFace): CardPlayableStatus => {
      if (gameState === GameState.Betting) {
        return {
          card,
          canPlay: false,
          reason: 'Cannot play cards during betting phase',
        };
      }
      if (!isMyTurn) {
        return {
          card,
          canPlay: false,
          reason: "It's not your turn",
        };
      }

      // If no cards played yet, any card is valid
      if (currentTrick.length === 0) {
        return { card, canPlay: true };
      }

      const ledSuit = getLedSuit();
      const cardSuit = card.split('_')[0]; // e.g., "hearts" from "hearts_K"

      // Player must follow suit if possible
      if (cardSuit === ledSuit) {
        return { card, canPlay: true };
      }

      // NEED TO VERIFY THESE RULES, YOU MAY BE ABLE TO PLAY TRUMP NO MATTER WHAT.
      // Check if player has any cards of the led suit
      const hasLedSuit = playerHand.some((c) => c.split('_')[0] === ledSuit);
      if (hasLedSuit) {
        return {
          card,
          canPlay: false,
          reason: 'Must follow suit',
        };
      }

      // If can't follow suit, must play trump if possible
      if (trumpCard && cardSuit !== trumpCard.split('_')[0]) {
        const hasTrump = playerHand.some((c) => c.split('_')[0] === trumpCard.split('_')[0]);
        if (hasTrump) {
          return {
            card,
            canPlay: false,
            reason: 'Must play trump',
          };
        }
      }

      // Otherwise, any card is valid
      return { card, canPlay: true };
    },
    [isMyTurn, currentTrick, getLedSuit, playerHand, trumpCard, gameState]
  );

  /**
   * Get sorted and playable hand (sorted by suit, then by rank descending)
   */
  const sortedHand = useMemo(() => {
    let sorted = (playerHand as CardFace[]).slice();

    // Sort by suit first (ascending: clubs → diamonds → hearts → spades)
    sorted.sort((a: CardFace, b: CardFace) => {
      const aSuit = getSuitOrder(a);
      const bSuit = getSuitOrder(b);

      const suitDiff = aSuit - bSuit;
      if (suitDiff !== 0) return suitDiff;

      // Secondary sort by rank descending (high to low)
      return getRankOrder(b) - getRankOrder(a);
    });

    return sorted;
  }, [playerHand]);

  /**
   * Get playable status for each card
   */
  const cardStatuses = useMemo(() => {
    return sortedHand.map((card) => getPlayableStatusForCard(card));
  }, [sortedHand, getPlayableStatusForCard]);

  /**
   * Get card image path
   */
  const getCardImagePath = (cardFace: CardFace): string => {
    const card = allPlayingCards.find((c) => c.face === cardFace);
    return card?.imagePath ?? '/images/cards/card_empty.png';
  };

  /**
   * Calculate fan effect for a card based on hovered card index
   * Cards rotate and shift to create an arc/fan pattern around the hovered card
   */
  const getFanEffect = useCallback(
    (cardIndex: number): { x: number; y: number; rotate: number } => {
      if (hoveredCardIndex === null || hoveredCardIndex === cardIndex) {
        return { x: 0, y: 0, rotate: 0 };
      }

      const distance = cardIndex - hoveredCardIndex;
      const maxDistance = 4; // Effect applies to up to 4 cards away
      const maxRotation = 20; // Maximum rotation in degrees
      const maxOffset = 20; // Maximum horizontal shift

      // Only apply effect to nearby cards
      if (Math.abs(distance) > maxDistance) {
        return { x: 0, y: 0, rotate: 0 };
      }

      // Calculate effect strength based on distance
      const normalizedDistance = Math.abs(distance) / maxDistance;
      const effectStrength = 1 - normalizedDistance * 0.2; // Fade effect for farther cards

      // Direction: left cards rotate/shift left, right cards rotate/shift right
      const direction = distance < 0 ? -1 : 1;

      // Rotation increases with distance from hovered card
      const rotation = direction * maxRotation * effectStrength;

      // Horizontal offset creates the fan spread
      const offset = maxOffset * effectStrength;

      return {
        x: direction * offset,
        y: 0,
        rotate: rotation,
      };
    },
    [hoveredCardIndex]
  );

  return (
    <div className={styles.handContainer}>
      {cardStatuses.map(({ card, canPlay, reason }, index) => (
        <Card
          key={card}
          cardFace={card}
          imagePath={getCardImagePath(card)}
          canPlay={canPlay}
          disabledReason={reason}
          onPlay={playCard}
          fanEffect={getFanEffect(index)}
          onMouseEnter={() => setHoveredCardIndex(index)}
          onMouseLeave={() => setHoveredCardIndex(null)}
        />
      ))}
    </div>
  );
};

export default Hand;
