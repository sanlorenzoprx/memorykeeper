const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

async function fetchWithAuth(path: string, options: RequestInit = {}, token?: string) {
    const headers = new Headers(options.headers);
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

export const apiGet = (path: string, token?: string) => fetchWithAuth(path, {}, token);

export const apiPost = (path:string, body: any, token?: string) => fetchWithAuth(path, {
    method: 'POST',
    body: JSON.stringify(body),
}, token);

export const apiPut = (path:string, body: any, token?: string) => fetchWithAuth(path, {
    method: 'PUT',
    body: JSON.stringify(body),
}, token);

export const apiDelete = (path:string, body?: any, token?: string) => fetchWithAuth(path, {
    method: 'DELETE',
    ...(body && { body: JSON.stringify(body) }),
}, token);