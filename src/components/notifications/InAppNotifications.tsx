'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Listens for forwarded push notifications from the service worker
 * and displays them as in-app toasts instead of OS-level notifications.
 *
 * The service worker sends these when the app is visible but the user
 * is not on the specific game page the notification is about.
 */
export function InAppNotifications() {
  const router = useRouter();

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'in-app-notification') return;

      const { title, body, url } = event.data;

      toast(title, {
        description: body,
        duration: 4000,
        action: url
          ? {
              label: 'Open',
              onClick: () => router.push(url),
            }
          : undefined,
      });
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handler);
    };
  }, [router]);

  return null;
}
