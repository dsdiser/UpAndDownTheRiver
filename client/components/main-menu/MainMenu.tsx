import React, { useState, useContext } from 'react';
import styles from './MainMenu.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import { MessageType } from '../../../types/messages';
import { useAtomValue } from 'jotai';
import { WebsocketContext } from '../../context/WebsocketContext';

interface MainMenuProps {
  isConnected: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({ isConnected }) => {
  const send = useContext(WebsocketContext);
  const roomMembers = useAtomValue(roomMembersAtom);
  const [requestSent, setRequestSent] = useState(false);

  const handleStartGame = () => {
    if (!isConnected || requestSent) return;
    setRequestSent(true);
    // Generate a random seed for reproducible shuffling
    send({ type: MessageType.GameStart });
  };

  return (
    <div className={styles.menu}>
      <div className={styles.header}>
        <h2>Up and Down the River</h2>
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
