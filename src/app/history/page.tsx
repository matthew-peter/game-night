'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Game, GamePlayer } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded } from '@/lib/game/gameLogic';
import { SoCloverBoardState } from '@/lib/game/soclover/types';
import { computeTotalScore, maxPossibleScore } from '@/lib/game/soclover/logic';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Trophy, Skull, Clock, Clover } from 'lucide-react';

type GameWithPlayers = Game & {
  game_players?: (GamePlayer & { user?: { username: string } })[];
};

function HistoryContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [games, setGames] = useState<GameWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchGames = async () => {
      // Get game IDs where user is a player
      const { data: myGames } = await supabase
        .from('game_players')
        .select('game_id')
        .eq('user_id', user.id);

      if (!myGames || myGames.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }

      const gameIds = myGames.map(g => g.game_id);

      const { data: gamesData, error } = await supabase
        .from('games')
        .select('*, game_players(*, user:users(username))')
        .in('id', gameIds)
        .eq('status', 'completed')
        .not('result', 'is', null)
        .order('ended_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error('Error fetching games:', error);
        setLoading(false);
        return;
      }

      setGames(gamesData ?? []);
      setLoading(false);
    };

    fetchGames();
  }, [user, supabase]);

  if (authLoading || loading) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className="h-dvh flex flex-col bg-stone-50 overflow-hidden">
      <Header />

      <main className="flex-1 overflow-y-auto max-w-lg mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-stone-800">Game History</h1>
        </div>

        {games.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-stone-500">No completed games yet</p>
              <Link href="/dashboard">
                <Button className="mt-4 bg-stone-700 hover:bg-stone-600">
                  Start a Game
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 pb-6">
            {games.map((game) => {
              const opponents = (game.game_players ?? [])
                .filter(p => p.user_id !== user.id);
              const opponentNames = opponents.map(p => p.user?.username).filter(Boolean);
              const isScrabble = game.game_type === 'scrabble';
              const isSoClover = game.game_type === 'so_clover';

              if (isSoClover) {
                const scBs = game.board_state as unknown as SoCloverBoardState;
                const totalScore = computeTotalScore(scBs.roundScores);
                const maxScore = maxPossibleScore(scBs.clovers.length);
                const won = game.result === 'win';

                return (
                  <Link key={game.id} href={`/game/${game.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              So Clover!
                            </span>
                            {won ? (
                              <Trophy className="h-5 w-5 text-emerald-600" />
                            ) : (
                              <Clover className="h-5 w-5 text-stone-400" />
                            )}
                            <span className="font-medium">
                              w/ {opponentNames.join(', ') || 'players'}
                            </span>
                          </div>
                          <Badge variant={won ? 'default' : 'secondary'} className={won ? 'bg-emerald-600' : ''}>
                            {totalScore}/{maxScore}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm text-stone-500">
                          <span>
                            {scBs.clovers.length} players
                          </span>
                          <span>
                            {game.ended_at && formatDistanceToNow(new Date(game.ended_at), { addSuffix: true })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              }

              if (isScrabble) {
                const bs = game.board_state as unknown as Record<string, unknown>;
                const scores = (bs.scores as number[]) ?? [];
                const allPlayers = game.game_players ?? [];
                const myPlayer = allPlayers.find(p => p.user_id === user.id);
                const mySeat = myPlayer?.seat ?? 0;
                const myScore = scores[mySeat] ?? 0;
                const maxScore = Math.max(...scores);
                const iWon = myScore === maxScore;

                return (
                  <Link key={game.id} href={`/game/${game.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              Scrabble
                            </span>
                            {iWon ? (
                              <Trophy className="h-5 w-5 text-amber-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-stone-400" />
                            )}
                            <span className="font-medium">
                              vs {opponentNames.join(', ') || 'players'}
                            </span>
                          </div>
                          <Badge variant={iWon ? 'default' : 'secondary'} className={iWon ? 'bg-amber-600' : ''}>
                            {iWon ? 'Won' : 'Lost'} ({myScore})
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-sm text-stone-500">
                          <span>
                            Scores: {scores.join(' - ')}
                          </span>
                          <span>
                            {game.ended_at && formatDistanceToNow(new Date(game.ended_at), { addSuffix: true })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              }

              // Codenames
              const won = game.result === 'win';
              const agentsFound = countAgentsFound(game.board_state);
              const totalAgents = countTotalAgentsNeeded(game.key_card);
              const assassinHit = Object.values(game.board_state.revealed).some(r => r.type === 'assassin');

              return (
                <Link key={game.id} href={`/game/${game.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            Codenames
                          </span>
                          {won ? (
                            <Trophy className="h-5 w-5 text-green-600" />
                          ) : assassinHit ? (
                            <Skull className="h-5 w-5 text-red-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-amber-600" />
                          )}
                          <span className="font-medium">
                            vs {opponentNames[0] ?? 'Unknown'}
                          </span>
                        </div>
                        <Badge variant={won ? 'default' : 'secondary'} className={won ? 'bg-green-600' : ''}>
                          {won ? 'Won' : assassinHit ? 'Assassin' : 'Lost'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm text-stone-500">
                        <span>
                          Agents: {agentsFound}/{totalAgents}
                        </span>
                        <span>
                          {game.ended_at && formatDistanceToNow(new Date(game.ended_at), { addSuffix: true })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AuthProvider>
      <HistoryContent />
    </AuthProvider>
  );
}
