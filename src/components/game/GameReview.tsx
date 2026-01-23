'use client';

import { Game, Move, CurrentTurn } from '@/lib/supabase/types';
import { countAgentsFound, countTotalAgentsNeeded, checkAssassinHit } from '@/lib/game/gameLogic';
import { getCardTypeForPlayer } from '@/lib/game/keyGenerator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface GameReviewProps {
  game: Game;
  moves: Move[];
  playerRole: CurrentTurn;
  player1Name: string;
  player2Name: string;
}

export function GameReview({ game, moves, playerRole, player1Name, player2Name }: GameReviewProps) {
  const agentsFound = countAgentsFound(game.board_state);
  const totalAgents = countTotalAgentsNeeded(game.key_card);
  const assassinHit = checkAssassinHit(game.board_state);
  const won = game.winner !== null && !assassinHit && agentsFound >= totalAgents;
  
  // Calculate stats
  const totalGuesses = moves.filter(m => m.move_type === 'guess').length;
  const correctGuesses = moves.filter(m => m.move_type === 'guess' && m.result === 'agent').length;
  const wrongGuesses = moves.filter(m => m.move_type === 'guess' && m.result === 'bystander').length;
  const totalClues = moves.filter(m => m.move_type === 'clue').length;
  
  return (
    <div className="min-h-screen bg-stone-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Result header */}
        <Card className={cn(
          'mb-6',
          won ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        )}>
          <CardHeader className="text-center pb-2">
            <CardTitle className={cn(
              'text-3xl',
              won ? 'text-green-700' : 'text-red-700'
            )}>
              {won ? '🎉 Victory!' : '💀 Game Over'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className={cn(
              'text-lg',
              won ? 'text-green-600' : 'text-red-600'
            )}>
              {won && 'You found all the agents!'}
              {assassinHit && 'An assassin was revealed!'}
              {!won && !assassinHit && 'Ran out of time!'}
            </p>
          </CardContent>
        </Card>
        
        {/* Stats */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Game Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{agentsFound}</p>
                <p className="text-sm text-stone-500">Agents Found</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-stone-600">{totalClues}</p>
                <p className="text-sm text-stone-500">Clues Given</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{correctGuesses}</p>
                <p className="text-sm text-stone-500">Correct Guesses</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{wrongGuesses}</p>
                <p className="text-sm text-stone-500">Wrong Guesses</p>
              </div>
            </div>
            
            {totalGuesses > 0 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-stone-500">
                  Accuracy: <span className="font-semibold">{Math.round((correctGuesses / totalGuesses) * 100)}%</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Final board */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Final Board</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-1">
              {game.words.map((word, index) => {
                const p1Type = getCardTypeForPlayer(index, game.key_card, 'player1');
                const p2Type = getCardTypeForPlayer(index, game.key_card, 'player2');
                const revealed = game.board_state.revealed[word];
                
                // Determine display color based on both keys
                let bgColor = 'bg-stone-100';
                if (p1Type === 'agent' || p2Type === 'agent') {
                  bgColor = 'bg-green-400';
                }
                if (p1Type === 'assassin' || p2Type === 'assassin') {
                  bgColor = 'bg-stone-800';
                }
                if (p1Type === 'agent' && p2Type === 'agent') {
                  bgColor = 'bg-green-600'; // Shared agent
                }
                if (p1Type === 'assassin' && p2Type === 'assassin') {
                  bgColor = 'bg-stone-950'; // Shared assassin
                }
                
                return (
                  <div
                    key={`${word}-${index}`}
                    className={cn(
                      'aspect-[4/3] rounded flex items-center justify-center p-1 text-[10px] sm:text-xs font-medium uppercase',
                      bgColor,
                      (p1Type === 'assassin' || p2Type === 'assassin') ? 'text-white' : 'text-stone-800',
                      revealed && 'ring-2 ring-offset-1',
                      revealed?.type === 'agent' && 'ring-green-600',
                      revealed?.type === 'bystander' && 'ring-amber-500',
                      revealed?.type === 'assassin' && 'ring-red-600'
                    )}
                  >
                    <span className="text-center leading-tight truncate">{word}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-600 rounded" />
                <span>Shared Agent</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-400 rounded" />
                <span>Agent (one side)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-stone-950 rounded" />
                <span>Shared Assassin</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-stone-800 rounded" />
                <span>Assassin (one side)</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Move history */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Move History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {moves.map((move, idx) => (
                  <div
                    key={move.id}
                    className={cn(
                      'p-2 rounded text-sm',
                      move.move_type === 'clue' && 'bg-blue-50',
                      move.move_type === 'guess' && 'bg-stone-50',
                      move.move_type === 'end_turn' && 'bg-stone-100'
                    )}
                  >
                    <span className="text-stone-400 text-xs mr-2">#{idx + 1}</span>
                    {move.move_type === 'clue' && (
                      <>
                        <span className="font-semibold">{move.clue_word}: {move.clue_number}</span>
                        {move.intended_words && move.intended_words.length > 0 && (
                          <span className="text-stone-500 ml-2">
                            (for: {move.intended_words.join(', ')})
                          </span>
                        )}
                      </>
                    )}
                    {move.move_type === 'guess' && (
                      <>
                        <span>Guessed </span>
                        <span className={cn(
                          'font-semibold',
                          move.result === 'agent' && 'text-green-600',
                          move.result === 'bystander' && 'text-amber-600',
                          move.result === 'assassin' && 'text-red-600'
                        )}>
                          {move.guessed_word}
                        </span>
                        <span className="ml-1">
                          {move.result === 'agent' && '✓'}
                          {move.result === 'bystander' && '○'}
                          {move.result === 'assassin' && '☠'}
                        </span>
                      </>
                    )}
                    {move.move_type === 'end_turn' && (
                      <span className="text-stone-500 italic">Turn ended</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline">Back to Dashboard</Button>
          </Link>
          <Link href="/dashboard">
            <Button className="bg-green-600 hover:bg-green-700">Play Again</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
