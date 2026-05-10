'use client';

import { type ReactNode } from 'react';
import { TrpcProvider } from '@/lib/trpc/client';

/**
 * Client-side provider chain that wraps the (auth) and (app) shells.
 * Marketing pages don't need tRPC and skip this layer.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <TrpcProvider>{children}</TrpcProvider>;
}
