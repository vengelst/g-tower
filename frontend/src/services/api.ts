const API_BASE = import.meta.env.VITE_API_URL;

const API = API_BASE
  ? `${API_BASE}/api`
  : '/api';

async function request<T>(endpoint: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${endpoint}`, { ...opts, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Nicht authentifiziert');
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

async function downloadBlob(endpoint: string): Promise<void> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${endpoint}`, { headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Nicht authentifiziert');
  }
  if (!res.ok) throw new Error('Download fehlgeschlagen');

  const disposition = res.headers.get('Content-Disposition') || '';
  let filename = 'download';
  const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
  const asciiMatch = disposition.match(/filename="(.+?)"/);
  if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
  else if (asciiMatch) filename = asciiMatch[1];

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  downloadBlob: (url: string) => downloadBlob(url),
};
