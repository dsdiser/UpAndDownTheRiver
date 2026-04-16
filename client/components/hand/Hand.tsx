import React, { useState, useMemo, useCallback, useContext, useEffect } from 'react';
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
import useComponentVisible from '../../hooks/useComponentInteractive';

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
  const { ref, isComponentVisible } = useComponentVisible(true);
  const user = useAtomValue(userAtom);
  const playerHand = useAtomValue(playerHandAtom);
  const activePlayerId = useAtomValue(activePlayerIdAtom);
  const currentTrick = useAtomValue(currentTrickAtom);
  const trumpCard = useAtomValue(trumpCardAtom);
  const send = useContext(WebsocketContext);
  const gameState = useAtomValue(gameStateAtom);

  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  const isMyTurn = user?.id === activePlayerId;

  // Clear selection when clicking outside the hand
  useEffect(() => {
    if (!isComponentVisible) {
      setSelectedCardIndex(null);
    }
  }, [isComponentVisible]);

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

  const handleCardSelectionChange = useCallback((index: number, isSelected: boolean) => {
    // otherwise handle selection change
    if (isSelected) {
      // Deselect previously selected card (if any) and select new one
      setSelectedCardIndex(index);
    } else {
      // Deselect if it's the currently selected card
      setSelectedCardIndex((prev) => (prev === index ? null : prev));
    }
  }, []);

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

      // TODO: NEED TO VERIFY THESE RULES, YOU MAY BE ABLE TO PLAY TRUMP NO MATTER WHAT.
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
      if (hoveredCardIndex === cardIndex) {
        return { x: 0, y: -20, rotate: 0 };
      } else if (hoveredCardIndex === null) {
        return { x: 0, y: 0, rotate: 0 };
      }
      const distance = cardIndex - hoveredCardIndex;
      const maxRotation = 10; // Maximum rotation in degrees
      const maxOffset = 10; // Maximum horizontal shift
      // Calculate effect strength based on distance
      const effectStrength = Math.abs(distance) * 0.4; // increase effect for farther cards
      // Direction: left cards rotate/shift left, right cards rotate/shift right
      const direction = distance < 0 ? -1 : 1;
      // Rotation increases with distance from hovered card
      const rotation = direction * maxRotation * effectStrength;
      // Horizontal offset creates the fan spread
      const offset = maxOffset;

      return {
        x: direction * offset,
        y: 40 * effectStrength, // Slight vertical lift for nearby cards
        rotate: rotation,
      };
    },
    [hoveredCardIndex]
  );

  return (
    <div
      ref={ref}
      className={styles.handContainer}
      style={
        {
          '--card-margin': `${Math.min(-20, -40 + (cardStatuses.length - 8) * 2)}px`,
          '--card-margin-tablet': `${Math.min(-18, -35 + (cardStatuses.length - 8) * 2)}px`,
          '--card-margin-mobile': `${Math.min(-12, -30 + (cardStatuses.length - 8) * 2)}px`,
          '--card-margin-small-height': `${Math.min(-10, -28 + (cardStatuses.length - 8) * 2)}px`,
        } as any
      }
    >
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
          isSelected={selectedCardIndex === index}
          onSelectionChange={(isSelected) => handleCardSelectionChange(index, isSelected)}
          style={{
            zIndex: selectedCardIndex === index ? 20 : index === hoveredCardIndex ? 10 : index,
          }}
        />
      ))}
    </div>
  );
};

export default Hand;
