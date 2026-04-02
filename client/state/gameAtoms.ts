import { atom } from 'jotai';
import type { CardFace, PlayedCard } from '../../types/messages';

export const activePlayerIdAtom = atom<string | null>(null);
export const playerHandAtom = atom<CardFace[]>([]);
export const playerHandSizesAtom = atom<Record<string, number>>({});
export const playedCardsAtom = atom<PlayedCard[]>([]);
export const currentTrickAtom = atom<PlayedCard[]>([]);
export const scoresAtom = atom<Record<string, number>>({});
export const trumpCardAtom = atom<CardFace | null>(null);
