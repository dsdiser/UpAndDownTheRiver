import React, { useState } from 'react';
import styles from './RoomInput.module.css';
import { setInstanceIdInUrl } from '../../hooks/useDiscordSdk';

interface RoomInputProps {
  initialRoomId?: string;
}

const isInIframe = window.self !== window.top;

const RoomInput: React.FC<RoomInputProps> = ({ initialRoomId = '' }) => {
  const [roomId, setRoomId] = useState(initialRoomId);

  const isValidRoomId = /^[a-zA-Z0-9]{4}$/.test(roomId);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
    setRoomId(value);
  };

  const handleSubmit = () => {
    if (!isValidRoomId) return;

    setInstanceIdInUrl(roomId.toUpperCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (isInIframe) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <span className={styles.label}>Room ID:</span>
      <input
        type="text"
        className={styles.input}
        value={roomId}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="ABCD"
        maxLength={4}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        className={styles.submitButton}
        onClick={handleSubmit}
        disabled={!isValidRoomId}
        title="Join Room"
      >
        <svg
          className={styles.checkIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  );
};

export default RoomInput;
