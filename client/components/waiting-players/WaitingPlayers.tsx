import React from 'react';
import styles from './WaitingPlayers.module.css';
import { Avatar } from '../avatar/Avatar';
import type { RemoteMember } from '../../state/userAtoms';

interface WaitingPlayersProps {
  players: RemoteMember[];
}

export const WaitingPlayers: React.FC<WaitingPlayersProps> = ({ players }) => {
  return (
    <section className={styles.waitingSection}>
      <div className={styles.waitingHeader}>
        <div>
          <h3>Late joiners</h3>
          <p>These players joined while the round was already in progress.</p>
        </div>
        <span className={styles.waitingBadge}>Waiting for next round</span>
      </div>

      <div className={styles.waitingAvatars}>
        {players.map((member) => (
          <div key={member.id} className={styles.waitingAvatarCard}>
            <Avatar userId={member.id} avatar={member.avatar ?? null} />
            <div className={styles.waitingLabel}>Waiting</div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WaitingPlayers;
