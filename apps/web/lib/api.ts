import { Hono } from 'hono';

const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';

async function fetchWithAuth(path: string, options: RequestInit = {}) {  
    // In a real app, you would get the token from Clerk's useAuth() hook  
    // For simplicity, we are assuming a token is available or not required for GET  
    const token = 'your-clerk-jwt'; // Replace with actual token retrieval  
      
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

export const apiGet = (path: string) => fetchWithAuth(path);

export const apiPost = (path:string, body: any) => fetchWithAuth(path, {  
    method: 'POST',  
    body: JSON.stringify(body),  
});

export const apiPut = (path:string, body: any) => fetchWithAuth(path, {  
    method: 'PUT',  
    body: JSON.stringify(body),  
});

export const apiDelete = (path:string) => fetchWithAuth(path, {  
    method: 'DELETE',  
});
