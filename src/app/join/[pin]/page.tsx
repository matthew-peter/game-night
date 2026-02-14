'use client';

import { useEffect, use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

function JoinGameContent({ pin }: { pin: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Store the pin and redirect to login
      sessionStorage.setItem('pendingGamePin', pin);
      router.push('/');
      return;
    }

    const joinGame = async () => {
      // Find game by PIN (uppercase to match)
      const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('*')
        .eq('pin', pin.toUpperCase())
        .single();

      if (fetchError || !game) {
        toast.error('Game not found');
        router.push('/dashboard');
        return;
      }

      if (game.player1_id === user.id) {
        // User is the creator
        if (game.status === 'waiting') {
          router.push(`/game/${game.id}/waiting`);
        } else {
          router.push(`/game/${game.id}`);
        }
        return;
      }

      if (game.status !== 'waiting') {
        if (game.player2_id === user.id) {
          // Already joined, go to game
          router.push(`/game/${game.id}`);
        } else {
          toast.error('Game has already started');
          router.push('/dashboard');
        }
        return;
      }

      // Join as player 2
      const { error: updateError } = await supabase
        .from('games')
        .update({
          player2_id: user.id,
          status: 'playing',
        })
        .eq('id', game.id);

      if (updateError) {
        toast.error('Failed to join game: ' + updateError.message);
        router.push('/dashboard');
        return;
      }

      // Notify player1 that someone joined
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: game.id,
            userId: game.player1_id,
            message: `${user.username || 'A player'} joined your game! Let's play!`,
            title: 'Player Joined!'
          }),
        });
      } catch {
        // Non-critical — player1 will see the game start via realtime
      }

      // Navigate directly — the game page loading IS the feedback.
      // No toast needed; the user just tapped "join" and seeing the
      // game board appear is the confirmation.
      router.push(`/game/${game.id}`);
    };

    joinGame().catch(() => {
      toast.error('An error occurred');
      router.push('/dashboard');
    });
  }, [user, loading, pin, router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-4 text-stone-600">Joining game...</p>
      </div>
    </div>
  );
}

export default function JoinPage({ params }: { params: Promise<{ pin: string }> }) {
  const resolvedParams = use(params);
  return (
    <AuthProvider>
      <JoinGameContent pin={resolvedParams.pin} />
    </AuthProvider>
  );
}
