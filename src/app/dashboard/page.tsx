'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';
import { getRandomWords } from '@/lib/game/words';
import { generateKeyCard } from '@/lib/game/keyGenerator';
import { generatePin } from '@/lib/utils/pin';
import { countAgentsFound, countTotalAgentsNeeded } from '@/lib/game/gameLogic';
import { ClueStrictness, Game, GamePlayer, GameType, findSeat } from '@/lib/supabase/types';
import { createScrabbleBoardState } from '@/lib/game/scrabble/logic';
import { toast } from 'sonner';
import { Plus, Users, History, Play, Clock, Loader2, Trash2, Gamepad2 } from 'lucide-react';
import Link from 'next/link';

type GameWithPlayers = Game & {
  game_players?: (GamePlayer & { user?: { username: string } })[];
};

function DashboardContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [joinPin, setJoinPin] = useState('');
  const [joiningGame, setJoiningGame] = useState(false);
  const [creatingGame, setCreatingGame] = useState(false);
  const [activeGames, setActiveGames] = useState<GameWithPlayers[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  // Game creation settings
  const [gameType, setGameType] = useState<GameType>('codenames');
  const [timerTokens, setTimerTokens] = useState(9);
  const [clueStrictness, setClueStrictness] = useState<ClueStrictness>('basic');
  const [firstClueGiver, setFirstClueGiver] = useState<'creator' | 'joiner' | 'random'>('random');
  const [allowWordSwaps, setAllowWordSwaps] = useState(true);
  const [maxWordSwaps, setMaxWordSwaps] = useState(3);
  const [scrabbleMaxPlayers, setScrabbleMaxPlayers] = useState(2);
  const [scrabbleDictionaryMode, setScrabbleDictionaryMode] = useState<'strict' | 'friendly' | 'off'>('friendly');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch active games
  useEffect(() => {
    if (!user) return;

    const fetchActiveGames = async () => {
      setLoadingGames(true);

      // Get game IDs where user is a player
      const { data: myGames } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('user_id', user.id);

      if (!myGames || myGames.length === 0) {
        setActiveGames([]);
        setLoadingGames(false);
        return;
      }

      const gameIds = myGames.map(g => g.game_id);

      const { data: games, error } = await supabase
        .from('games')
        .select('*, game_players(*, user:users(username))')
        .in('id', gameIds)
        .in('status', ['playing', 'waiting'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching games:', error);
        setLoadingGames(false);
        return;
      }

      setActiveGames(games ?? []);
      setLoadingGames(false);
    };

    fetchActiveGames();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchActiveGames();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const channel = supabase
      .channel('dashboard-games')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'games' },
        (payload) => {
          setActiveGames(prev => prev.filter(g => g.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games' },
        (payload) => {
          const updatedGame = payload.new as Game;
          if (updatedGame.status === 'completed' || updatedGame.status === 'abandoned') {
            setActiveGames(prev => prev.filter(g => g.id !== updatedGame.id));
          } else {
            setActiveGames(prev => prev.map(g =>
              g.id === updatedGame.id
                ? { ...g, ...updatedGame }
                : g
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, supabase]);

  const handleDeleteGame = async (gameId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this game? This cannot be undone.')) {
      return;
    }

    try {
      await supabase.from('moves').delete().eq('game_id', gameId);
      await supabase.from('game_players').delete().eq('game_id', gameId);

      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId);

      if (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete game');
        return;
      }

      setActiveGames(prev => prev.filter(g => g.id !== gameId));
      toast.success('Game deleted');
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Failed to delete game');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  const handleCreateGame = async () => {
    setCreatingGame(true);

    try {
      const pin = generatePin();
      const gameId = crypto.randomUUID();

      let gameInsert: Record<string, unknown>;

      if (gameType === 'scrabble') {
        const maxPlayers = scrabbleMaxPlayers;
        const boardState = createScrabbleBoardState(maxPlayers, scrabbleDictionaryMode);

        gameInsert = {
          id: gameId,
          game_type: 'scrabble',
          pin,
          status: 'waiting',
          current_turn: 0,
          current_phase: 'play',
          min_players: 2,
          max_players: maxPlayers,
          board_state: boardState,
          words: [],
          key_card: [],
          timer_tokens: 0,
          clue_strictness: 'basic',
          sudden_death: false,
        };
      } else {
        // Codenames
        const words = getRandomWords(25);
        const keyCard = generateKeyCard();

        const resolvedFirstClue = firstClueGiver === 'random'
          ? (Math.random() < 0.5 ? 'creator' : 'joiner')
          : firstClueGiver;

        const boardState: Record<string, unknown> = {
          revealed: {},
          agents_found: [0, 0],
        };

        if (allowWordSwaps) {
          boardState.setup = {
            enabled: true,
            maxSwaps: maxWordSwaps,
            swapsUsed: [0, 0],
            ready: [false, false],
          };
        }

        gameInsert = {
          id: gameId,
          game_type: 'codenames',
          pin,
          status: 'waiting',
          key_card: keyCard,
          words,
          board_state: boardState,
          timer_tokens: timerTokens,
          clue_strictness: clueStrictness,
          current_turn: resolvedFirstClue === 'creator' ? 0 : 1,
          current_phase: 'clue',
          min_players: 2,
          max_players: 2,
          sudden_death: false,
        };
      }

      const insertResult = await supabase.from('games').insert(gameInsert);
      console.log('[Dashboard] game insert result:', insertResult.status, insertResult.error);

      if (insertResult.error) {
        console.error('Error creating game:', insertResult.error);
        toast.error('Failed to create game: ' + insertResult.error.message);
        return;
      }

      // Add creator as seat 0
      const playerResult = await supabase
        .from('game_players')
        .insert({
          game_id: gameId,
          user_id: user.id,
          seat: 0,
        });
      console.log('[Dashboard] game_players insert result:', playerResult.status, playerResult.error);

      if (playerResult.error) {
        console.error('Error adding player:', playerResult.error);
        await supabase.from('games').delete().eq('id', gameId);
        toast.error('Failed to join game: ' + playerResult.error.message);
        return;
      }

      setShowCreateDialog(false);
      router.push(`/game/${gameId}/waiting`);
    } catch (error) {
      console.error('Error creating game:', error);
      toast.error('Failed to create game');
    } finally {
      setCreatingGame(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();

    if (joinPin.length !== 6) {
      toast.error('PIN must be 6 digits');
      return;
    }

    setJoiningGame(true);

    try {
      const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('pin', joinPin)
        .eq('status', 'waiting')
        .single();

      if (fetchError || !game) {
        toast.error('Game not found or already started');
        return;
      }

      // Check if already in the game
      const { data: existingPlayer } = await supabase
        .from('game_players')
        .select('seat')
        .eq('game_id', game.id)
        .eq('user_id', user.id)
        .single();

      if (existingPlayer) {
        router.push(`/game/${game.id}/waiting`);
        return;
      }

      // Find next available seat
      const { data: existingPlayers } = await supabase
        .from('game_players')
        .select('seat')
        .eq('game_id', game.id)
        .order('seat', { ascending: true });

      const takenSeats = new Set((existingPlayers ?? []).map(p => p.seat));
      let nextSeat = 0;
      while (takenSeats.has(nextSeat)) nextSeat++;

      if (nextSeat >= (game.max_players ?? 2)) {
        toast.error('Game is full');
        return;
      }

      // Join via game_players
      const { error: joinError } = await supabase
        .from('game_players')
        .insert({
          game_id: game.id,
          user_id: user.id,
          seat: nextSeat,
        });

      if (joinError) {
        console.error('Error joining game:', joinError);
        toast.error('Failed to join game: ' + joinError.message);
        return;
      }

      // If we have enough players, start the game
      const currentPlayerCount = takenSeats.size + 1;
      if (currentPlayerCount >= (game.min_players ?? 2)) {
        await supabase
          .from('games')
          .update({ status: 'playing' })
          .eq('id', game.id)
          .eq('status', 'waiting');
      }

      // Notify other players
      try {
        const { data: otherPlayers } = await supabase
          .from('game_players')
          .select('user_id')
          .eq('game_id', game.id)
          .neq('user_id', user.id);

        for (const other of otherPlayers ?? []) {
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: game.id,
              userId: other.user_id,
              message: `${user.username || 'A player'} joined your game! Let's play!`,
              title: 'Player Joined!'
            }),
          });
        }
      } catch (e) {
        console.error('Failed to send join notification:', e);
      }

      router.push(`/game/${game.id}`);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error('Failed to join game');
    } finally {
      setJoiningGame(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      <main className="max-w-lg mx-auto px-4 py-4">
        <h1 className="text-xl font-bold text-stone-800 mb-4">
          Welcome, {user.username}!
        </h1>

        {/* Active Games */}
        {(loadingGames || activeGames.length > 0) && (
          <Card className="mb-3 border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">Active Games</span>
              </div>
              {loadingGames ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {activeGames.map((game) => {
                    const gamePlayers = game.game_players ?? [];
                    const mySeat = findSeat(gamePlayers, user.id);
                    const opponents = gamePlayers.filter(p => p.user_id !== user.id);
                    const opponentNames = opponents.map(p => p.user?.username).filter(Boolean);
                    const isScrabble = game.game_type === 'scrabble';

                    // Turn detection
                    let isYourTurn = false;
                    if (isScrabble) {
                      isYourTurn = game.current_turn === mySeat;
                    } else {
                      const amIClueGiver = game.current_turn === mySeat;
                      const isCluePhase = game.current_phase === 'clue';
                      isYourTurn = (amIClueGiver && isCluePhase) || (!amIClueGiver && !isCluePhase);
                    }
                    const isWaiting = game.status === 'waiting';

                    // Game-specific progress info
                    let progressText = '';
                    let turnText = '';
                    if (!isWaiting) {
                      if (isScrabble) {
                        const bs = game.board_state as unknown as Record<string, unknown>;
                        const scores = (bs.scores as number[]) ?? [];
                        const myScore = mySeat !== undefined ? scores[mySeat] ?? 0 : 0;
                        progressText = `Score: ${myScore}`;
                        turnText = isYourTurn ? 'Your turn' : "Opponent's turn";
                      } else {
                        const agentsFound = countAgentsFound(game.board_state);
                        const totalAgents = countTotalAgentsNeeded(game.key_card);
                        progressText = `${agentsFound}/${totalAgents} found`;
                        const isCluePhase = game.current_phase === 'clue';
                        turnText = isYourTurn
                          ? `Your turn (${isCluePhase ? 'clue' : 'guess'})`
                          : 'Their turn';
                      }
                    }

                    const gameTypeLabel = isScrabble ? 'Scrabble' : 'Codenames';
                    const gameTypeColor = isScrabble ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

                    return (
                      <div
                        key={game.id}
                        className="flex items-center gap-2 p-3 bg-white rounded-lg border border-emerald-100 hover:border-emerald-300 transition-colors"
                      >
                        <Link
                          href={isWaiting ? `/game/${game.id}/waiting` : `/game/${game.id}`}
                          className="flex-1 min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gameTypeColor}`}>
                              {gameTypeLabel}
                            </span>
                            <span className="font-medium text-stone-800 truncate">
                              {isWaiting
                                ? 'Waiting for players...'
                                : `w/ ${opponentNames.join(', ') || 'players'}`}
                            </span>
                            {isWaiting && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                PIN: {game.pin}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {!isWaiting && (
                              <>
                                <span className="text-xs text-stone-400">
                                  {progressText}
                                </span>
                                <span className="text-xs">
                                  {isYourTurn ? (
                                    <span className="text-emerald-600 font-medium">
                                      {turnText}
                                    </span>
                                  ) : (
                                    <span className="text-stone-400 flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {turnText}
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center gap-1">
                          <Link href={isWaiting ? `/game/${game.id}/waiting` : `/game/${game.id}`}>
                            <Button size="sm" variant={isYourTurn ? 'default' : 'outline'} className={isYourTurn ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                              {isWaiting ? 'View' : 'Resume'}
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-stone-400 hover:text-red-600 hover:bg-red-50 p-2"
                            onClick={(e) => handleDeleteGame(game.id, e)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Create Game */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-green-600" />
                <span className="font-medium">Create New Game</span>
              </div>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-green-600 hover:bg-green-700">
                    Create
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Game</DialogTitle>
                    <DialogDescription>
                      Choose a game and configure settings
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    {/* Game Type Selector */}
                    <div className="space-y-2">
                      <Label>Game</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setGameType('codenames')}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            gameType === 'codenames'
                              ? 'border-green-600 bg-green-50'
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="font-medium text-sm">Codenames Duet</div>
                          <div className="text-xs text-stone-500 mt-0.5">2 players • Co-op word game</div>
                        </button>
                        <button
                          onClick={() => setGameType('scrabble')}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            gameType === 'scrabble'
                              ? 'border-amber-600 bg-amber-50'
                              : 'border-stone-200 hover:border-stone-300'
                          }`}
                        >
                          <div className="font-medium text-sm">Scrabble</div>
                          <div className="text-xs text-stone-500 mt-0.5">2-4 players • Word building</div>
                        </button>
                      </div>
                    </div>

                    {/* Scrabble Settings */}
                    {gameType === 'scrabble' && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Number of Players: {scrabbleMaxPlayers}</Label>
                          <Slider
                            value={[scrabbleMaxPlayers]}
                            onValueChange={(v) => setScrabbleMaxPlayers(v[0])}
                            min={2}
                            max={4}
                            step={1}
                            className="w-full"
                          />
                          <p className="text-xs text-stone-500">
                            Game starts when {scrabbleMaxPlayers} players have joined.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Dictionary Rules</Label>
                          <Select
                            value={scrabbleDictionaryMode}
                            onValueChange={(v) => setScrabbleDictionaryMode(v as 'strict' | 'friendly' | 'off')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="friendly">
                                Friendly &mdash; play any word, look up to check
                              </SelectItem>
                              <SelectItem value="strict">
                                Strict &mdash; only dictionary words accepted
                              </SelectItem>
                              <SelectItem value="off">
                                No rules &mdash; any word goes
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-stone-500">
                            {scrabbleDictionaryMode === 'friendly'
                              ? 'Words are accepted on the honor system. Use the word checker to look up disputed words.'
                              : scrabbleDictionaryMode === 'strict'
                                ? 'The server will reject words not found in the dictionary.'
                                : 'Play anything. No dictionary checking available.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Codenames Settings */}
                    {gameType === 'codenames' && (
                      <>
                        <div className="space-y-3">
                          <Label>Timer Tokens: {timerTokens}</Label>
                          <Slider
                            value={[timerTokens]}
                            onValueChange={(v) => setTimerTokens(v[0])}
                            min={7}
                            max={11}
                            step={1}
                            className="w-full"
                          />
                          <p className="text-xs text-stone-500">
                            Standard: 9 tokens. More = easier, fewer = harder.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Clue Validation</Label>
                          <Select
                            value={clueStrictness}
                            onValueChange={(v) => setClueStrictness(v as ClueStrictness)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basic">
                                Basic - Clue can&apos;t be exact word on board
                              </SelectItem>
                              <SelectItem value="strict">
                                Strict - No substrings allowed
                              </SelectItem>
                              <SelectItem value="very_strict">
                                Very Strict - No shared word roots
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Who gives the first clue?</Label>
                          <Select
                            value={firstClueGiver}
                            onValueChange={(v) => setFirstClueGiver(v as 'creator' | 'joiner' | 'random')}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="creator">
                                Me (game creator)
                              </SelectItem>
                              <SelectItem value="joiner">
                                The other player (who joins)
                              </SelectItem>
                              <SelectItem value="random">
                                Random
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Word Swaps</Label>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Let players swap out words they don&apos;t know before the game starts
                              </p>
                            </div>
                            <Switch
                              checked={allowWordSwaps}
                              onCheckedChange={setAllowWordSwaps}
                            />
                          </div>
                          {allowWordSwaps && (
                            <div className="space-y-2 pl-1">
                              <Label className="text-sm">Max swaps per player: {maxWordSwaps}</Label>
                              <Slider
                                value={[maxWordSwaps]}
                                onValueChange={(v) => setMaxWordSwaps(v[0])}
                                min={1}
                                max={5}
                                step={1}
                                className="w-full"
                              />
                              <p className="text-xs text-stone-500">
                                Each player can independently swap up to {maxWordSwaps} word{maxWordSwaps !== 1 ? 's' : ''} before playing.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <Button
                    onClick={handleCreateGame}
                    disabled={creatingGame}
                    className={`w-full ${gameType === 'scrabble' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {creatingGame ? 'Creating...' : `Start ${gameType === 'scrabble' ? 'Scrabble' : 'Codenames'} Game`}
                  </Button>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Join Game */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <form onSubmit={handleJoinGame} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Join Game</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter PIN"
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, ''))}
                  className="w-32 text-center tracking-widest font-mono"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={joinPin.length !== 6 || joiningGame}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {joiningGame ? '...' : 'Join'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Game History */}
        <Card>
          <CardContent className="p-3">
            <Link href="/history" className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-stone-600" />
                <span className="font-medium">Game History</span>
              </div>
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
