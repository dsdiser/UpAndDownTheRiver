import { atom } from 'jotai';
import type { User } from '../types/user';

export const userAtom = atom<User | undefined>(undefined);

// RemoteMember represents another user in the same room
export type RemoteMember = {
  id: string;
  avatar?: string;
};

// Current members in the connected room (presence)
export const roomMembersAtom = atom<RemoteMember[]>([]);
