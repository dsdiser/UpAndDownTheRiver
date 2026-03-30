import React, { useState } from 'react';
import styles from './MainMenu.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import { MessageType, OutgoingMessage } from '../../../types/messages';
import { useAtomValue } from 'jotai';

interface MainMenuProps {
  send: (message: OutgoingMessage) => void;
  isConnected: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({ send, isConnected }) => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const [requestSent, setRequestSent] = useState(false);

  const handleStartGame = () => {
    if (!isConnected || requestSent) return;
    setRequestSent(true);
    const newSeed = Math.floor(Math.random() * 0xffffffff);
    send({ type: MessageType.GameStart, seed: newSeed });
  };

  return (
    <div className={styles.menu}>
      <div className={styles.header}>
        <h2>Up and Down the River</h2>
        <p>Players can join the room and then start the game together.</p>
      </div>

      <div className={styles.playerList}>
        {roomMembers.length > 0 ? (
          <div className={styles.statusMessage}>
            Players have joined — their avatars appear in the overlay below.
          </div>
        ) : (
          <div className={styles.emptyState}>No players have joined yet.</div>
        )}
      </div>

      <button
        className={styles.startButton}
        onClick={handleStartGame}
        disabled={!isConnected || requestSent || roomMembers.length < 1}
      >
        {requestSent ? 'Starting Game...' : 'Start Game'}
      </button>
    </div>
  );
};

export default MainMenu;
