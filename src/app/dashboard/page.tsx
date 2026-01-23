'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { Header } from '@/components/shared/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { createClient } from '@/lib/supabase/client';
import { getRandomWords } from '@/lib/game/words';
import { generateKeyCard } from '@/lib/game/keyGenerator';
import { generatePin } from '@/lib/utils/pin';
import { ClueStrictness, Game } from '@/lib/supabase/types';
import { toast } from 'sonner';
import { Plus, Users, History, Share2 } from 'lucide-react';
import Link from 'next/link';

function DashboardContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  
  const [joinPin, setJoinPin] = useState('');
  const [joiningGame, setJoiningGame] = useState(false);
  const [creatingGame, setCreatingGame] = useState(false);
  
  // Game creation settings
  const [timerTokens, setTimerTokens] = useState(9);
  const [clueStrictness, setClueStrictness] = useState<ClueStrictness>('strict');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

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
      const words = getRandomWords(25);
      const keyCard = generateKeyCard();
      const pin = generatePin();
      
      // Match the actual database schema
      const newGame = {
        id: crypto.randomUUID(),
        pin,
        status: 'waiting',
        player1_id: user.id,
        player2_id: null,
        key_card: keyCard,
        words,
        board_state: { revealed: {} },
        timer_tokens: timerTokens,
        clue_strictness: clueStrictness,
        current_turn: 'player1',
        current_phase: 'clue',
        player1_agents_found: 0,
        player2_agents_found: 0,
        sudden_death: false,
      };
      
      const { error } = await supabase.from('games').insert(newGame);
      
      if (error) {
        console.error('Error creating game:', error);
        toast.error('Failed to create game: ' + error.message);
        return;
      }
      
      setShowCreateDialog(false);
      router.push(`/game/${newGame.id}/waiting`);
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
      // Find game by PIN
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
      
      if (game.player1_id === user.id) {
        // Already the creator, just go to waiting room
        router.push(`/game/${game.id}/waiting`);
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
        toast.error('Failed to join game');
        return;
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
      
      <main className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-stone-800 mb-6">
          Welcome, {user.username}!
        </h1>
        
        {/* Create Game */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Create New Game
            </CardTitle>
            <CardDescription>
              Start a new game and invite a friend to join
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="w-full bg-green-600 hover:bg-green-700">
                  Create Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Game Settings</DialogTitle>
                  <DialogDescription>
                    Configure your game before starting
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Timer tokens */}
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
                  
                  {/* Clue strictness */}
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
                </div>
                
                <Button
                  onClick={handleCreateGame}
                  disabled={creatingGame}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {creatingGame ? 'Creating...' : 'Start Game'}
                </Button>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        
        {/* Join Game */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Join Game
            </CardTitle>
            <CardDescription>
              Enter a 6-digit PIN to join a friend&apos;s game
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinGame} className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="Enter PIN"
                value={joinPin}
                onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, ''))}
                className="flex-1 text-center text-lg tracking-widest font-mono"
              />
              <Button
                type="submit"
                disabled={joinPin.length !== 6 || joiningGame}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {joiningGame ? 'Joining...' : 'Join'}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* Game History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-stone-600" />
              Recent Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/history">
              <Button variant="outline" className="w-full">
                View Game History
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
