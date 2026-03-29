import { atom } from 'jotai';
import { GameState } from '../types/gameState';

export const gameStateAtom = atom<GameState>(GameState.WaitingForPlayers);
