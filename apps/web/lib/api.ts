import { Hono } from 'hono';

const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

async function fetchWithAuth(path: string, token: string | null, options: RequestInit = {}) {
    const headers = new Headers(options.headers);

    // Add authentication token if available
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // Add development user ID header if no token (for local development)
    if (!token && process.env.NODE_ENV === 'development') {
        headers.set('X-Dev-User-Id', 'dev-user-123');
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

export const apiGet = (path: string, token: string | null) => fetchWithAuth(path, token);

export const apiPost = (path:string, body: any, token: string | null) => fetchWithAuth(path, token, {
    method: 'POST',
    body: JSON.stringify(body),
});

export const apiPut = (path:string, body: any, token: string | null) => fetchWithAuth(path, token, {
    method: 'PUT',
    body: JSON.stringify(body),
});

export const apiDelete = (path:string, token: string | null, body?: any) => fetchWithAuth(path, token, {
    method: 'DELETE',
    ...(body && { body: JSON.stringify(body) }),
});