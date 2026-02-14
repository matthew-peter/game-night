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
      sessionStorage.setItem('pendingGamePin', pin);
      router.push('/');
      return;
    }

    const joinGame = async () => {
      // Find game by PIN
      const { data: game, error: fetchError } = await supabase
        .from('games')
        .select('id, status, min_players, max_players')
        .eq('pin', pin.toUpperCase())
        .single();

      if (fetchError || !game) {
        toast.error('Game not found');
        router.push('/dashboard');
        return;
      }

      // Check if already in this game
      const { data: existingPlayer } = await supabase
        .from('game_players')
        .select('seat')
        .eq('game_id', game.id)
        .eq('user_id', user.id)
        .single();

      if (existingPlayer) {
        // Already in the game, just navigate
        if (game.status === 'waiting') {
          router.push(`/game/${game.id}/waiting`);
        } else {
          router.push(`/game/${game.id}`);
        }
        return;
      }

      if (game.status !== 'waiting') {
        toast.error('Game has already started');
        router.push('/dashboard');
        return;
      }

      // Find next available seat
      const { data: existingPlayers } = await supabase
        .from('game_players')
        .select('seat, user_id')
        .eq('game_id', game.id)
        .order('seat', { ascending: true });

      const takenSeats = new Set((existingPlayers ?? []).map(p => p.seat));
      let nextSeat = 0;
      while (takenSeats.has(nextSeat)) nextSeat++;

      if (nextSeat >= (game.max_players ?? 2)) {
        toast.error('Game is full');
        router.push('/dashboard');
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
        toast.error('Failed to join game: ' + joinError.message);
        router.push('/dashboard');
        return;
      }

      // Check if we have enough players to start
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
        const otherPlayerIds = (existingPlayers ?? [])
          .filter(p => p.user_id !== user.id)
          .map(p => p.user_id);

        for (const otherId of otherPlayerIds) {
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: game.id,
              userId: otherId,
              message: `${user.username || 'A player'} joined your game! Let's play!`,
              title: 'Player Joined!'
            }),
          });
        }
      } catch {
        // Non-critical
      }

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
