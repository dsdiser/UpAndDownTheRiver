import React, { useState, useMemo, useCallback } from 'react';
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
import { usePlayCard } from '../../hooks/usePlayCard';

type SortKey = 'rank' | 'suit';
type SortDirection = 'asc' | 'desc';
const ranks = ['02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K', 'A'];
const suits = ['clubs', 'diamonds', 'hearts', 'spades'];

interface CardPlayableStatus {
  card: CardFace;
  canPlay: boolean;
  reason?: string;
}

/**
 * Hand component - displays current player's hand with sorting and validation.
 *
 * Features:
 * - Sort by rank or suit (ascending/descending)
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

  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const isPlayerActive = user?.id === activePlayerId;

  const playCard = usePlayCard();

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
      if (!isPlayerActive) {
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
    [isPlayerActive, currentTrick, getLedSuit, playerHand, trumpCard]
  );

  /**
   * Get sorted and playable hand
   */
  const sortedHand = useMemo(() => {
    let sorted = (playerHand as CardFace[]).slice();

    // Sort based on selected key
    if (sortKey === 'rank') {
      sorted.sort((a: CardFace, b: CardFace) => {
        const aRank = getRankOrder(a);
        const bRank = getRankOrder(b);
        return sortDirection === 'asc' ? aRank - bRank : bRank - aRank;
      });
    } else {
      // Sort by suit
      sorted.sort((a: CardFace, b: CardFace) => {
        const aSuit = getSuitOrder(a);
        const bSuit = getSuitOrder(b);

        // If same suit, sort by rank secondarily
        const suitDiff = sortDirection === 'asc' ? aSuit - bSuit : bSuit - aSuit;
        if (suitDiff !== 0) return suitDiff;

        // Secondary sort by rank (always ascending for consistency)
        return getRankOrder(a) - getRankOrder(b);
      });
    }

    return sorted;
  }, [playerHand, sortKey, sortDirection]);

  /**
   * Get playable status for each card
   */
  const cardStatuses = useMemo(() => {
    return sortedHand.map((card) => getPlayableStatusForCard(card));
  }, [sortedHand, getPlayableStatusForCard]);

  /**
   * Toggle sort key between rank and suit
   */
  const toggleSortKey = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        // Toggle direction if same key
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        // Switch to new key, default to ascending
        setSortKey(key);
        setSortDirection('asc');
      }
    },
    [sortKey]
  );

  /**
   * Get card image path
   */
  const getCardImagePath = (cardFace: CardFace): string => {
    const card = allPlayingCards.find((c) => c.face === cardFace);
    return card?.imagePath ?? '/images/cards/card_empty.png';
  };

  if (!user) {
    return <div className={styles.hand}></div>;
  }

  return (
    <div className={styles.handContainer}>
      <div className={styles.handHeader}>
        <h3 className={styles.title}>Your Hand</h3>
        <div className={styles.sortControls}>
          <button
            className={`${styles.sortButton} ${sortKey === 'rank' ? styles.active : ''}`}
            onClick={() => toggleSortKey('rank')}
            title={
              sortKey === 'rank'
                ? `Sort by rank ${sortDirection === 'asc' ? '(low to high)' : '(high to low)'}`
                : 'Sort by rank (low to high)'
            }
          >
            Rank{' '}
            {sortKey === 'rank' && (
              <span className={styles.direction}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
          <button
            className={`${styles.sortButton} ${sortKey === 'suit' ? styles.active : ''}`}
            onClick={() => toggleSortKey('suit')}
            title={
              sortKey === 'suit'
                ? `Sort by suit ${sortDirection === 'asc' ? '(clubs → spades)' : '(spades → clubs)'}`
                : 'Sort by suit (clubs → spades)'
            }
          >
            Suit{' '}
            {sortKey === 'suit' && (
              <span className={styles.direction}>{sortDirection === 'asc' ? '→' : '←'}</span>
            )}
          </button>
        </div>
      </div>

      <div className={styles.hand}>
        {cardStatuses.map(({ card, canPlay, reason }) => (
          <Card
            key={card}
            cardFace={card}
            imagePath={getCardImagePath(card)}
            canPlay={canPlay}
            disabledReason={reason}
            onPlay={playCard}
          />
        ))}
      </div>

      {playerHand.length === 0 && <div className={styles.emptyHand}>No cards in hand</div>}
    </div>
  );
};

export default Hand;
