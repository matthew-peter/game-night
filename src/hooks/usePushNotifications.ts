'use client';

import { useEffect, useState, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      
      // Check for existing subscription
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(sub => {
          setSubscription(sub);
          setIsChecking(false);
        });
      }).catch(() => {
        setIsChecking(false);
      });
    } else {
      setIsChecking(false);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return null;

    setIsLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setIsLoading(false);
        return null;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });

      setSubscription(sub);

      // Save subscription to database
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          subscription: JSON.stringify(sub.toJSON()),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });
      }

      setIsLoading(false);
      return sub;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      setIsLoading(false);
      return null;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    setIsLoading(true);
    try {
      await subscription.unsubscribe();
      setSubscription(null);

      // Remove from database
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      setIsLoading(false);
    }
  }, [subscription]);

  return {
    permission,
    subscription,
    isSupported,
    isLoading,
    isChecking,
    subscribe,
    unsubscribe,
    isSubscribed: !!subscription
  };
}
