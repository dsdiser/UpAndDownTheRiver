import { atom } from 'jotai';
// import { atomWithListeners } from './atomWithListeners';

export const flipAnimationDuration = 4.5; // seconds
// Example of listener for event based
// export const [startFlipAtom, useStartFlipListener] = atomWithListeners<boolean>(false);

// Atom to store the user ID of the active flipper
export const activeFlipperUserIdAtom = atom<string | null>(null);
