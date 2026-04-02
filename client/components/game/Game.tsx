import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import styles from './Game.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import { playerHandSizesAtom } from '../../state/gameAtoms';
import WaitingPlayers from '../waiting-players/WaitingPlayers';
import Hand from '../hand/Hand';

const Game: React.FC = () => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerHandSizes = useAtomValue(playerHandSizesAtom);

  const waitingPlayers = useMemo(
    () => roomMembers.filter((member) => !(member.id in playerHandSizes)),
    [roomMembers, playerHandSizes]
  );

  return (
    <div className={styles.gameScreen}>
      <Hand />
      {waitingPlayers.length > 0 && <WaitingPlayers players={waitingPlayers} />}
    </div>
  );
};

export default Game;
