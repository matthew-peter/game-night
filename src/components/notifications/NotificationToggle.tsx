'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';

export function NotificationToggle() {
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission,
    isChecking,
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  // Show loading state while checking support
  if (isChecking) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="text-white/50"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (!isSupported) {
    return null; // Don't show anything if not supported
  }

  if (permission === 'denied') {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="text-white/50"
        title="Notifications blocked - enable in browser settings"
      >
        <BellOff className="w-4 h-4" />
      </Button>
    );
  }

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={isLoading}
      className={isSubscribed ? 'text-emerald-400' : 'text-white/70 hover:text-white'}
      title={isSubscribed ? 'Notifications enabled' : 'Enable notifications'}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="w-4 h-4" />
      ) : (
        <BellOff className="w-4 h-4" />
      )}
    </Button>
  );
}
