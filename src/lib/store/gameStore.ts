import { create } from 'zustand';
import { Game, User, Move, Seat, GamePlayer, findSeat } from '@/lib/supabase/types';

interface GameState {
  // User state
  user: User | null;
  setUser: (user: User | null) => void;

  // Current game state
  game: Game | null;
  setGame: (game: Game | null) => void;
  updateGame: (updates: Partial<Game>) => void;

  // Move history
  moves: Move[];
  setMoves: (moves: Move[]) => void;
  addMove: (move: Move) => void;
  /** Merge moves from a refetch, deduplicating by id, preserving order */
  mergeMoves: (moves: Move[]) => void;

  // Local UI state for clue giving
  selectedWordsForClue: Set<string>;
  toggleWordForClue: (word: string) => void;
  clearSelectedWords: () => void;

  // Other players in this game
  players: GamePlayer[];
  setPlayers: (players: GamePlayer[]) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;

  // Helper: get the current user's seat in the game
  getMySeat: () => Seat | undefined;

  // Helper: get the opponent(s) — all players who aren't the current user
  getOpponents: () => GamePlayer[];

  // Reset all state
  reset: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // User state
  user: null,
  setUser: (user) => set({ user }),

  // Game state
  game: null,
  setGame: (game) => set({ game }),
  updateGame: (updates) =>
    set((state) => ({
      game: state.game ? { ...state.game, ...updates } : null,
    })),

  // Moves — deduplicated by id
  moves: [],
  setMoves: (moves) => set({ moves }),
  addMove: (move) =>
    set((state) => {
      if (state.moves.some((m) => m.id === move.id)) return state;
      return { moves: [...state.moves, move] };
    }),
  mergeMoves: (incoming) =>
    set((state) => {
      const incomingIds = new Set(incoming.map((m) => m.id));
      const merged = [...incoming];
      for (const m of state.moves) {
        if (!incomingIds.has(m.id)) merged.push(m);
      }
      return { moves: merged };
    }),

  // Selected words for clue
  selectedWordsForClue: new Set<string>(),
  toggleWordForClue: (word) =>
    set((state) => {
      const newSet = new Set(state.selectedWordsForClue);
      if (newSet.has(word)) newSet.delete(word);
      else newSet.add(word);
      return { selectedWordsForClue: newSet };
    }),
  clearSelectedWords: () => set({ selectedWordsForClue: new Set() }),

  // Players
  players: [],
  setPlayers: (players) => set({ players }),

  // Loading
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  // Error
  error: null,
  setError: (error) => set({ error }),

  // Get current user's seat
  getMySeat: () => {
    const { user, players } = get();
    if (!user) return undefined;
    return findSeat(players, user.id);
  },

  // Get opponents (all players who aren't me)
  getOpponents: () => {
    const { user, players } = get();
    if (!user) return [];
    return players.filter((p) => p.user_id !== user.id);
  },

  // Reset
  reset: () =>
    set({
      game: null,
      moves: [],
      selectedWordsForClue: new Set(),
      players: [],
      error: null,
    }),
}));
