'use client';
import { create } from 'zustand';
import type { School, SessionUser } from '@controle-escolas/contracts';

interface AppState {
  user: SessionUser | null;
  schools: School[];
  /** school id, or 'all' for the consolidated view */
  school: string;
  year: number;
  setSession: (user: SessionUser, schools: School[]) => void;
  setSchools: (schools: School[]) => void;
  setSchool: (school: string) => void;
  setYear: (year: number) => void;
}

export const useApp = create<AppState>((set) => ({
  user: null,
  schools: [],
  school: 'all',
  year: new Date().getFullYear(),
  setSession: (user, schools) => set({ user, schools }),
  setSchools: (schools) => set({ schools }),
  setSchool: (school) => set({ school }),
  setYear: (year) => set({ year }),
}));

// Records belong to one school: with "all" selected, the first school is the working one.
export function useTargetSchool(): School {
  const { school, schools } = useApp();
  return (schools.find((s) => s.id === school) ?? schools[0]) as School;
}
