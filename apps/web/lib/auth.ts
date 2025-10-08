'use client';

import { useAuth } from '@clerk/nextjs';

/**
 * Returns an async function that fetches the current Clerk JWT.
 * Usage:
 *   const getAuthToken = useAuthToken();
 *   const token = await getAuthToken();
 */
export function useAuthToken() {
  const { getToken } = useAuth();
  return async (options?: Parameters<typeof getToken>[0]) => {
    const token = await getToken(options);
    return token || undefined;
  };
}