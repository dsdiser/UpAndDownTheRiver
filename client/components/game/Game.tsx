import React, { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import styles from './Game.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import { playerHandSizesAtom, playerBetsAtom, scoresAtom } from '../../state/gameAtoms';
import { gameStateAtom } from '../../state/gameStateAtom';
import { GameState } from '../../types/gameState';
import WaitingPlayers from '../waiting-players/WaitingPlayers';
import Hand from '../hand/Hand';
import BettingScreen from '../betting-screen/BettingScreen';
import PlayerSeats from '../player-seats/PlayerSeats';

const Game: React.FC = () => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerHandSizes = useAtomValue(playerHandSizesAtom);
  const playerBets = useAtomValue(playerBetsAtom);
  const scores = useAtomValue(scoresAtom);
  const gameState = useAtomValue(gameStateAtom);

  const waitingPlayers = useMemo(
    () => roomMembers.filter((member) => !(member.id in playerHandSizes)),
    [roomMembers, playerHandSizes]
  );

  return (
    <div className={styles.gameScreen}>
      <PlayerSeats
        roomMembers={roomMembers}
        playerHandSizes={playerHandSizes}
        playerBets={playerBets}
        scores={scores}
      />
      <Hand />
      {waitingPlayers.length > 0 && <WaitingPlayers players={waitingPlayers} />}
      {gameState === GameState.Betting && <BettingScreen />}
    </div>
  );
};

export default Game;
