import { useEffect, useCallback, useState } from 'react';
import * as notificationService from '@/src/services/notificationService';
import { useAuth } from '@/src/contexts/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export function usePushNotification() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported] = useState(
    () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  );

  useEffect(() => {
    if (isSupported) setPermission(Notification.permission);
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!user?.id || !isSupported || !VAPID_PUBLIC_KEY) return;
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) { setIsSubscribed(true); return; }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const ua = navigator.userAgent.slice(0, 200);
      await notificationService.upsertPushSubscription({
        userId: user.id, subscription: sub.toJSON(), userAgent: ua,
      });

      setIsSubscribed(true);
    } catch (err) {
      console.warn('[usePushNotification] subscribe failed:', err);
    }
  }, [user?.id, isSupported]);

  const requestAndSubscribe = useCallback(async () => {
    if (!isSupported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') await subscribe();
  }, [isSupported, subscribe]);

  // Auto-subscribe quando permissão já foi concedida anteriormente
  useEffect(() => {
    if (permission === 'granted' && user?.id && VAPID_PUBLIC_KEY) subscribe();
  }, [permission, user?.id, subscribe]);

  return { permission, isSubscribed, isSupported, requestAndSubscribe };
}
