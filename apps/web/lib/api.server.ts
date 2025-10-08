import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';

const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

export async function fetchWithAuthServer(path: string, init: RequestInit = {}) {
  const { getToken } = auth();
  const token = await getToken({ template: 'default' }).catch(() => undefined);

  const hdrs = new Headers(init.headers);
  if (token) hdrs.set('Authorization', `Bearer ${token}`);
  if (init.body) hdrs.set('Content-Type', 'application/json');

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: hdrs,
    // Forward select headers if needed
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed with status ' + res.status }));
    throw new Error(errorData.error || 'API request failed');
  }

  return res.json();
}