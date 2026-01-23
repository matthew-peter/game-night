import { create } from 'zustand';
import { Game, User, Move, CurrentTurn } from '@/lib/supabase/types';

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
  
  // Local UI state for clue giving
  selectedWordsForClue: Set<string>;
  toggleWordForClue: (word: string) => void;
  clearSelectedWords: () => void;
  
  // Other players
  opponent: User | null;
  setOpponent: (user: User | null) => void;
  
  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Error state
  error: string | null;
  setError: (error: string | null) => void;
  
  // Helper to get current player role
  getPlayerRole: () => CurrentTurn | null;
  
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
  updateGame: (updates) => set((state) => ({
    game: state.game ? { ...state.game, ...updates } : null
  })),
  
  // Moves
  moves: [],
  setMoves: (moves) => set({ moves }),
  addMove: (move) => set((state) => ({ moves: [...state.moves, move] })),
  
  // Selected words for clue
  selectedWordsForClue: new Set<string>(),
  toggleWordForClue: (word) => set((state) => {
    const newSet = new Set(state.selectedWordsForClue);
    if (newSet.has(word)) {
      newSet.delete(word);
    } else {
      newSet.add(word);
    }
    return { selectedWordsForClue: newSet };
  }),
  clearSelectedWords: () => set({ selectedWordsForClue: new Set() }),
  
  // Opponent
  opponent: null,
  setOpponent: (opponent) => set({ opponent }),
  
  // Loading
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
  
  // Error
  error: null,
  setError: (error) => set({ error }),
  
  // Helper to get current player role
  getPlayerRole: () => {
    const { user, game } = get();
    if (!user || !game) return null;
    if (game.player1_id === user.id) return 'player1';
    if (game.player2_id === user.id) return 'player2';
    return null;
  },
  
  // Reset
  reset: () => set({
    game: null,
    moves: [],
    selectedWordsForClue: new Set(),
    opponent: null,
    error: null
  })
}));
