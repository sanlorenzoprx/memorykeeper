'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { useRef } from 'react';

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Create client per-instance to avoid SSR hydration issues
  const clientRef = useRef<QueryClient>();

  if (!clientRef.current) {
    clientRef.current = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          retry: (failureCount, error) => {
            // Don't retry on 4xx errors (client errors)
            if (error && typeof error === 'object' && 'status' in error) {
              const status = (error as any).status;
              if (status >= 400 && status < 500) {
                return false;
              }
            }
            return failureCount < 3;
          },
        },
        mutations: {
          retry: false,
        },
      },
    });
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      {children}
    </QueryClientProvider>
  );
}
