const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

interface ApiOptions extends RequestInit {
    token?: string;
}

async function fetchWithAuth(path: string, options: ApiOptions = {}) {
    const { token, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);

    // Set content type for JSON requests
    if (fetchOptions.body && typeof fetchOptions.body === 'string') {
        headers.set('Content-Type', 'application/json');
    }

    // Add JWT token if provided
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${base}${path}`, {
        ...fetchOptions,
        headers,
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Request failed with status ' + res.status }));
        throw new Error(errorData.error || 'API request failed');
    }

    return res.json();
}

export const apiGet = (path: string, token?: string) => fetchWithAuth(path, { token });

export const apiPost = (path: string, body: any, token?: string) => fetchWithAuth(path, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
});

export const apiPut = (path: string, body: any, token?: string) => fetchWithAuth(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    token,
});

export const apiDelete = (path: string, body?: any, token?: string) => fetchWithAuth(path, {
    method: 'DELETE',
    ...(body && { body: JSON.stringify(body) }),
    token,
});