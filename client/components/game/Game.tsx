import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import styles from './Game.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import { playerHandSizesAtom } from '../../state/gameAtoms';
import WaitingPlayers from '../waiting-players/WaitingPlayers';

const Game: React.FC = () => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerHandSizes = useAtomValue(playerHandSizesAtom);

  const waitingPlayers = useMemo(
    () => roomMembers.filter((member) => !(member.id in playerHandSizes)),
    [roomMembers, playerHandSizes]
  );

  return (
    <div className={styles.gameScreen}>
      <h2>Game view coming soon</h2>
      <p>The game has started. Replace this placeholder with your actual game UI.</p>

      {waitingPlayers.length > 0 && <WaitingPlayers players={waitingPlayers} />}
    </div>
  );
};

export default Game;
