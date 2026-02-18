'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { AuthForm } from '@/components/auth/AuthForm';

function LandingContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-stone-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-600 mx-auto"></div>
          <p className="mt-4 text-stone-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-stone-50 to-white">
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-8" style={{ paddingTop: 'calc(2rem + env(safe-area-inset-top))' }}>
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-stone-800 mb-2">
            GAME NIGHT
          </h1>
          <p className="text-stone-500 text-lg max-w-md mx-auto">
            Play board games online with friends and family. No downloads, no accounts to share &mdash; just a PIN.
          </p>
        </div>

        {/* Auth Form */}
        <AuthForm />

        {/* Games */}
        <div className="mt-16 grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          <div className="p-5 rounded-xl bg-white border border-stone-200 shadow-sm">
            <div className="text-2xl mb-2">🕵️</div>
            <h3 className="font-semibold text-stone-800 mb-1">Codenames Duet</h3>
            <p className="text-sm text-stone-500">2 players. Cooperative word guessing. Find all the agents before time runs out.</p>
          </div>
          <div className="p-5 rounded-xl bg-white border border-stone-200 shadow-sm">
            <div className="text-2xl mb-2">🔤</div>
            <h3 className="font-semibold text-stone-800 mb-1">Scrabble</h3>
            <p className="text-sm text-stone-500">2–4 players. Build words, score points, and outsmart your opponents on a classic board.</p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 grid sm:grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div className="text-2xl mb-2">📱</div>
            <h3 className="font-semibold text-stone-700 mb-1">Play Anywhere</h3>
            <p className="text-sm text-stone-400">Mobile-first. Install as an app or play in your browser.</p>
          </div>
          <div className="p-4">
            <div className="text-2xl mb-2">🔔</div>
            <h3 className="font-semibold text-stone-700 mb-1">Push Notifications</h3>
            <p className="text-sm text-stone-400">Get notified when it&apos;s your turn. Never miss a move.</p>
          </div>
          <div className="p-4">
            <div className="text-2xl mb-2">💬</div>
            <h3 className="font-semibold text-stone-700 mb-1">In-Game Chat</h3>
            <p className="text-sm text-stone-400">Talk strategy or trash talk. Real-time chat in every game.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-stone-400 space-y-1 pb-8">
          <p>Codenames Duet by Vlaada Chv&aacute;til &amp; Scot Eaton, published by Czech Games Edition.</p>
          <p>Scrabble is a registered trademark. This is a fan-made, non-commercial project.</p>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <LandingContent />
    </AuthProvider>
  );
}
