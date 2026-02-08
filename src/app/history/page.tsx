'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Game } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded } from '@/lib/game/gameLogic';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Trophy, Skull, Clock } from 'lucide-react';

interface GameWithOpponent extends Game {
  opponent_username?: string;
}

function HistoryContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  
  const [games, setGames] = useState<GameWithOpponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchGames = async () => {
      // Fetch completed games where user was a player (must have a result)
      const { data: gamesData, error } = await supabase
        .from('games')
        .select('*')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .eq('status', 'completed')
        .not('result', 'is', null)
        .order('ended_at', { ascending: false, nullsFirst: false })
        .limit(50);

      if (error) {
        console.error('Error fetching games:', error);
        setLoading(false);
        return;
      }

      // Fetch opponent usernames
      const gamesWithOpponents: GameWithOpponent[] = [];
      
      for (const game of gamesData || []) {
        const opponentId = game.player1_id === user.id ? game.player2_id : game.player1_id;
        
        if (opponentId) {
          const { data: opponentData } = await supabase
            .from('users')
            .select('username')
            .eq('id', opponentId)
            .single();
          
          gamesWithOpponents.push({
            ...game,
            opponent_username: opponentData?.username || 'Unknown',
          });
        } else {
          gamesWithOpponents.push({
            ...game,
            opponent_username: 'No opponent',
          });
        }
      }

      setGames(gamesWithOpponents);
      setLoading(false);
    };

    fetchGames();
  }, [user, supabase]);

  if (authLoading || loading) {
    return (
      <div className="h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
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
                <Button className="mt-4 bg-green-600 hover:bg-green-700">
                  Start a Game
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 pb-6">
            {games.map((game) => {
                const playerRole = game.player1_id === user.id ? 'player1' : 'player2';
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
                            {won ? (
                              <Trophy className="h-5 w-5 text-green-600" />
                            ) : assassinHit ? (
                              <Skull className="h-5 w-5 text-red-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-amber-600" />
                            )}
                            <span className="font-medium">
                              vs {game.opponent_username}
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
