import React, { useMemo, useCallback, useContext } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import styles from './Game.module.css';
import { roomMembersAtom } from '../../state/userAtoms';
import {
  playerHandSizesAtom,
  playerBetsAtom,
  scoresAtom,
  currentUserBetAtom,
  handSizeAtom,
} from '../../state/gameAtoms';
import { gameStateAtom } from '../../state/gameStateAtom';
import { WebsocketContext } from '../../context/WebsocketContext';
import WaitingPlayers from '../waiting-players/WaitingPlayers';
import Hand from '../hand/Hand';
import PlayerSeats from '../player-seats/PlayerSeats';
import { MessageType } from '../../../types/messages';

const Game: React.FC = () => {
  const roomMembers = useAtomValue(roomMembersAtom);
  const playerHandSizes = useAtomValue(playerHandSizesAtom);
  const playerBets = useAtomValue(playerBetsAtom);
  const scores = useAtomValue(scoresAtom);
  const gameState = useAtomValue(gameStateAtom);
  const currentUserBet = useAtomValue(currentUserBetAtom);
  const handSize = useAtomValue(handSizeAtom);
  const setCurrentUserBet = useSetAtom(currentUserBetAtom);
  const send = useContext(WebsocketContext);

  const waitingPlayers = useMemo(
    () => roomMembers.filter((member) => !(member.id in playerHandSizes)),
    [roomMembers, playerHandSizes]
  );

  const handleBetChange = useCallback(
    (newBet: number) => {
      const clampedBet = Math.max(0, Math.min(newBet, handSize));
      setCurrentUserBet(clampedBet);
    },
    [setCurrentUserBet, handSize]
  );

  const handleSubmitBet = useCallback(() => {
    send({
      type: MessageType.BetPlaced,
      bet: currentUserBet,
    });
  }, [currentUserBet, send]);

  return (
    <div className={styles.gameScreen}>
      <PlayerSeats
        roomMembers={roomMembers}
        playerHandSizes={playerHandSizes}
        playerBets={playerBets}
        scores={scores}
        gameState={gameState}
        currentUserBet={currentUserBet}
        onBetChange={handleBetChange}
        onBetSubmit={handleSubmitBet}
      />

      {waitingPlayers.length > 0 && <WaitingPlayers players={waitingPlayers} />}
      <Hand />
    </div>
  );
};

export default Game;
