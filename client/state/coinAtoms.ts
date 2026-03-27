import { atom, createStore } from 'jotai';
import { atomWithListeners } from './atomWithListeners';

export const flipAnimationDuration = 4.5; // seconds
export const [startFlipAtom, useStartFlipListener] = atomWithListeners<boolean>(false);

// Atom to store the user ID of the active flipper
export const activeFlipperUserIdAtom = atom<string | null>(null);

// Seed atom (for coin flip animation)
export const seedStore = createStore();
const seed = Math.floor(Math.random() * 0xffffffff);

export const seedAtom = atom<number>(seed);
seedStore.set(seedAtom, seed);
// Utility to set a new random seed
export const setRandomSeedAtom = atom(null, (_get, set) => {
  // make a random int32
  const newSeed = Math.floor(Math.random() * 0xffffffff);
  set(seedAtom, newSeed);
  seedStore.set(seedAtom, newSeed);
});
