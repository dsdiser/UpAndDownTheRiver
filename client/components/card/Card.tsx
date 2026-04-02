import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import styles from './Card.module.css';
import type { CardFace } from '../../types/cards';

interface CardProps {
  /** The card face to display (e.g., 'hearts_K') */
  cardFace: CardFace;
  /** Path to the card image (e.g., '/images/cards/card_hearts_K.png') */
  imagePath: string;
  /** Whether this card can be played */
  canPlay: boolean;
  /** Reason why the card can't be played (displayed in tooltip) */
  disabledReason?: string;
  /** Callback when card is played */
  onPlay: (cardFace: CardFace) => void;
}

/**
 * Card component - displays individual playing card with responsive sizing.
 *
 * Interaction model:
 * - Web (desktop): Single click to play
 * - Mobile: First click to select, second click to play
 *
 * Disabled cards are greyed out and show tooltip explaining why.
 * Cards animate out when played successfully.
 * Cards cannot be played during betting phase.
 */
export const Card: React.FC<CardProps> = ({
  cardFace,
  imagePath,
  canPlay,
  disabledReason,
  onPlay,
}) => {
  const [isSelected, setIsSelected] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Detect if device supports touch on mount
  useEffect(() => {
    const isTouchDevice = () =>
      (typeof window !== 'undefined' &&
        ('ontouchstart' in window ||
          (navigator as any).maxTouchPoints > 0 ||
          (navigator as any).msMaxTouchPoints > 0)) ||
      false;

    setIsTouchDevice(isTouchDevice());
  }, []);

  const handleClick = useCallback(() => {
    // During betting phase, cards cannot be played
    // If card can't be played, don't do anything
    if (!canPlay || isAnimatingOut) {
      return;
    }

    // Mobile: first click selects, second click plays
    if (isTouchDevice) {
      if (!isSelected) {
        setIsSelected(true);
      } else {
        // Second click - play the card
        setIsAnimatingOut(true);
        onPlay(cardFace);
      }
    } else {
      // Web: single click plays immediately
      setIsAnimatingOut(true);
      onPlay(cardFace);
    }
  }, [cardFace, canPlay, isTouchDevice, isSelected, isAnimatingOut, onPlay]);

  // Deselect card when it's played successfully
  useEffect(() => {
    if (!isAnimatingOut) {
      setIsSelected(false);
    }
  }, [isAnimatingOut]);

  return (
    <motion.div
      className={`${styles.cardContainer} ${!canPlay ? styles.disabled : ''} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      animate={isAnimatingOut ? { opacity: 0, y: -20 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onAnimationComplete={() => {
        if (isAnimatingOut) {
          setIsAnimatingOut(false);
        }
      }}
      title={disabledReason}
      role="button"
      tabIndex={canPlay ? 0 : -1}
      onKeyDown={(e) => {
        if (canPlay && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={styles.cardImageWrapper}>
        <img src={imagePath} alt={cardFace} className={styles.cardImage} draggable={false} />
      </div>

      {/* Tooltip for disabled reason */}
      {!canPlay && disabledReason && <div className={styles.tooltip}>{disabledReason}</div>}
    </motion.div>
  );
};

export default Card;
