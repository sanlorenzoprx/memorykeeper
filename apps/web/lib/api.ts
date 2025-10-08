const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

async function getAuthToken(): Promise<string | undefined> {
  if (typeof window === 'undefined') return undefined;
  const clerk = (window as any).Clerk;
  if (!clerk || !clerk.session || typeof clerk.session.getToken !== 'function') {
    return undefined;
  }
  try {
    const token = await clerk.session.getToken({ template: 'default' });
    return token || undefined;
  } catch {
    return undefined;
  }
}

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  // Attach Authorization header if a Clerk session token is available
  const token = await getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed with status ' + res.status }));
    throw new Error(errorData.error || 'API request failed');
  }

  return res.json();
}

export const apiGet = (path: string) => fetchWithAuth(path);

export const apiPost = (path:string, body: any) => fetchWithAuth(path, {
  method: 'POST',
  body: JSON.stringify(body),
});

export const apiPut = (path:string, body: any) => fetchWithAuth(path, {
  method: 'PUT',
  body: JSON.stringify(body),
});

export const apiDelete = (path:string, body?: any) => fetchWithAuth(path, {
  method: 'DELETE',
  ...(body && { body: JSON.stringify(body) }),
});