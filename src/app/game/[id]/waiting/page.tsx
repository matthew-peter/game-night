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
        toast.error('Game not found');
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
      title: 'Codenames Duet',
      text: `Join my Codenames Duet game! PIN: ${game.pin}`,
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
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen bg-stone-50">
      <Header />
      
      <main className="max-w-lg mx-auto px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Waiting for Player 2</CardTitle>
            <CardDescription>
              Share the PIN or link with your friend to start playing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* PIN Display */}
            <div className="text-center">
              <p className="text-sm text-stone-500 mb-2">Game PIN</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-4xl font-mono font-bold tracking-[0.3em] text-green-600">
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
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
              <span className="text-stone-600">Waiting for opponent to join...</span>
            </div>

            {/* Game settings summary */}
            <div className="bg-stone-100 rounded-lg p-4 text-sm">
              <h4 className="font-medium text-stone-700 mb-2">Game Settings</h4>
              <div className="grid grid-cols-2 gap-2 text-stone-600">
                <span>Timer Tokens:</span>
                <span className="font-medium">{game.timer_tokens}</span>
                <span>Clue Rules:</span>
                <span className="font-medium capitalize">{game.clue_strictness.replace('_', ' ')}</span>
                <span>Word Swaps:</span>
                <span className="font-medium">
                  {game.board_state.setup?.enabled
                    ? `${game.board_state.setup.maxSwaps} per player`
                    : 'Off'}
                </span>
              </div>
            </div>

            {/* Share button */}
            <Button
              onClick={handleShare}
              className="w-full bg-green-600 hover:bg-green-700"
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
