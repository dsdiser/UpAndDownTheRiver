import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import styles from './Game.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import { playerHandSizesAtom } from '../../state/gameAtoms';
import { gameStateAtom } from '../../state/gameStateAtom';
import { GameState } from '../../types/gameState';
import WaitingPlayers from '../waiting-players/WaitingPlayers';
import Hand from '../hand/Hand';
import BettingScreen from '../betting-screen/BettingScreen';

const Game: React.FC = () => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerHandSizes = useAtomValue(playerHandSizesAtom);
  const gameState = useAtomValue(gameStateAtom);

  const waitingPlayers = useMemo(
    () => roomMembers.filter((member) => !(member.id in playerHandSizes)),
    [roomMembers, playerHandSizes]
  );

  if (gameState === GameState.Betting) {
    return <BettingScreen />;
  }

  return (
    <div className={styles.gameScreen}>
      <Hand />
      {waitingPlayers.length > 0 && <WaitingPlayers players={waitingPlayers} />}
    </div>
  );
};

export default Game;
