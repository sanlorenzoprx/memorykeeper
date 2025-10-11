'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { apiGet } from '@/lib/api';

interface SubscriptionData {
  isSubscribed: boolean;
  plan: 'free' | 'premium' | 'pro';
  features: string[];
  expiresAt?: string;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionData>({
    isSubscribed: false,
    plan: 'free',
    features: ['Basic photo upload', 'Voice captions'],
  });
  const [isLoading, setIsLoading] = useState(true);
  const { isSignedIn, getToken } = useAuth();

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isSignedIn) {
        setSubscription({
          isSubscribed: false,
          plan: 'free',
          features: ['Basic photo upload', 'Voice captions'],
        });
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        const data = await apiGet('/api/user/subscription', token);
        setSubscription(data);
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
        // Default to free plan on error
        setSubscription({
          isSubscribed: false,
          plan: 'free',
          features: ['Basic photo upload', 'Voice captions'],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [isSignedIn, getToken]);

  return {
    ...subscription,
    isLoading,
  };
}
