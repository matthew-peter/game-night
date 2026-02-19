'use client';

import { useEffect, useState, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Game } from '@/lib/supabase/types';
import { toast } from 'sonner';
import { Copy, Share2, Loader2, Check } from 'lucide-react';

function WaitingRoomContent({ gameId }: { gameId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);
  
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (error || !data) {
        console.error('[WaitingRoom] fetch error:', error, 'gameId:', gameId);
        toast.error(error?.message ? `Error: ${error.message}` : 'Game not found');
        router.push('/dashboard');
        return;
      }

      setGame(data);
      setLoading(false);

      // If game has started, redirect to game
      if (data.status === 'playing') {
        router.push(`/game/${gameId}`);
      }
    };

    fetchGame();

    // Subscribe to game changes
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as Game;
          setGame(updatedGame);

          // If game has started, redirect
          if (updatedGame.status === 'playing') {
            router.push(`/game/${gameId}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase, router]);

  const handleCopyPin = async () => {
    if (!game) return;
    
    try {
      await navigator.clipboard.writeText(game.pin);
      setCopied(true);
      toast.success('PIN copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy PIN');
    }
  };

  const handleShare = async () => {
    if (!game) return;
    
    const shareUrl = `${window.location.origin}/join/${game.pin}`;
    const shareData = {
      title: 'Game Night',
      text: `Join my game! PIN: ${game.pin}`,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      // User cancelled share
    }
  };

  const handleCancelGame = async () => {
    if (!game) return;
    
    const { error } = await supabase
      .from('games')
      .update({ status: 'abandoned' })
      .eq('id', game.id);

    if (error) {
      toast.error('Failed to cancel game');
      return;
    }

    router.push('/dashboard');
  };

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  if (!game) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-stone-50">
      <Header />
      
      <main className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {game.game_type === 'so_clover' ? 'So Clover!' : game.game_type === 'scrabble' ? 'Scrabble' : 'Codenames Duet'}
            </CardTitle>
            <CardDescription>
              {game.game_type === 'so_clover'
                ? `Waiting for players (need ${game.max_players ?? 3} total)`
                : game.game_type === 'scrabble'
                  ? `Waiting for players (need ${game.max_players ?? 2} total)`
                  : 'Waiting for one more player'}
              {' — '}share the PIN or link to start
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PIN Display */}
            <div className="text-center">
              <p className="text-sm text-stone-500 mb-2">Game PIN</p>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-4xl font-mono font-bold tracking-[0.3em] ${game.game_type === 'so_clover' ? 'text-emerald-600' : game.game_type === 'scrabble' ? 'text-amber-600' : 'text-green-600'}`}>
                  {game.pin}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyPin}
                  className="text-stone-500"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Waiting animation */}
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className={`h-5 w-5 animate-spin ${game.game_type === 'so_clover' ? 'text-emerald-600' : game.game_type === 'scrabble' ? 'text-amber-600' : 'text-green-600'}`} />
              <span className="text-stone-600">Waiting for players to join...</span>
            </div>

            {/* Game settings summary */}
            <div className="bg-stone-100 rounded-lg p-4 text-sm">
              <h4 className="font-medium text-stone-700 mb-2">Game Settings</h4>
              <div className="grid grid-cols-2 gap-2 text-stone-600">
                <span>Game:</span>
                <span className="font-medium capitalize">
                  {game.game_type === 'so_clover' ? 'So Clover!' : game.game_type === 'scrabble' ? 'Scrabble' : 'Codenames Duet'}
                </span>
                <span>Players:</span>
                <span className="font-medium">{game.max_players ?? 2}</span>
                {game.game_type === 'scrabble' && (
                  <>
                    <span>Dictionary:</span>
                    <span className="font-medium capitalize">
                      {(() => {
                        const bs = game.board_state as unknown as Record<string, unknown>;
                        const mode = bs?.dictionaryMode as string;
                        return mode === 'strict' ? 'Strict' : mode === 'off' ? 'No rules' : 'Friendly';
                      })()}
                    </span>
                  </>
                )}
                {game.game_type === 'codenames' && (
                  <>
                    <span>Timer Tokens:</span>
                    <span className="font-medium">{game.timer_tokens}</span>
                    <span>Clue Rules:</span>
                    <span className="font-medium capitalize">{game.clue_strictness?.replace('_', ' ') ?? 'basic'}</span>
                    <span>Word Swaps:</span>
                    <span className="font-medium">
                      {game.board_state.setup?.enabled
                        ? `${game.board_state.setup.maxSwaps} per player`
                        : 'Off'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Share button */}
            <Button
              onClick={handleShare}
              className={`w-full ${game.game_type === 'so_clover' ? 'bg-emerald-600 hover:bg-emerald-700' : game.game_type === 'scrabble' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Invite Link
            </Button>

            {/* Cancel button */}
            <Button
              variant="outline"
              onClick={handleCancelGame}
              className="w-full text-stone-500"
            >
              Cancel Game
            </Button>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}

export default function WaitingPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <AuthProvider>
      <WaitingRoomContent gameId={resolvedParams.id} />
    </AuthProvider>
  );
}
