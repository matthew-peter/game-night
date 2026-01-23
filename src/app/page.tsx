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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-stone-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-green-600 mb-2">
            CODENAMES
          </h1>
          <div className="inline-block bg-green-600 text-white px-4 py-1 rounded-full text-lg font-semibold mb-6">
            DUET
          </div>
          <p className="text-stone-600 text-lg max-w-md mx-auto">
            Play the cooperative word game with a friend. Give clues, guess words, find all the agents!
          </p>
        </div>

        {/* Auth Form */}
        <AuthForm />

        {/* Features */}
        <div className="mt-16 grid sm:grid-cols-3 gap-6 text-center">
          <div className="p-4">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="font-semibold text-stone-800 mb-1">Cooperative</h3>
            <p className="text-sm text-stone-500">Work together to find all 15 agents</p>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">📱</div>
            <h3 className="font-semibold text-stone-800 mb-1">Play Anywhere</h3>
            <p className="text-sm text-stone-500">Mobile-first design, play from any device</p>
          </div>
          <div className="p-4">
            <div className="text-3xl mb-2">🔗</div>
            <h3 className="font-semibold text-stone-800 mb-1">Easy Sharing</h3>
            <p className="text-sm text-stone-500">Invite friends with a simple link</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-stone-400">
          <p>Based on Codenames Duet by Vlaada Chvátil & Scot Eaton</p>
          <p>Published by Czech Games Edition</p>
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
