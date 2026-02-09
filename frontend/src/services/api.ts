/**
 * @module api
 *
 * @description
 * Zentrale HTTP-Abstraktionsschicht fuer das gesamte Frontend.
 * Stellt eine einheitliche Schnittstelle (get, post, put, patch, delete, downloadBlob)
 * bereit, die von allen Service-Modulen (towerService, ticketService, etc.) verwendet wird.
 *
 * @role_im_system
 * Einziger Kontaktpunkt zwischen Frontend und Backend-REST-API.
 * Kapselt Authentifizierung, Fehlerbehandlung und Content-Type-Logik,
 * sodass die einzelnen Services nur noch Endpunkte und Typen kennen muessen.
 *
 * @abhaengigkeiten
 * - Umgebungsvariable VITE_API_URL (optional, Fallback auf relativen Pfad '/api')
 * - JWT-Token im localStorage unter dem Schluessel 'token'
 * - Browser-APIs: fetch, FormData, Blob, URL.createObjectURL
 *
 * @wichtige_annahmen
 * - Das Backend liefert bei 401 immer "nicht authentifiziert" => Token wird geloescht, Redirect auf /login
 * - 204-Responses haben keinen Body und werden als undefined zurueckgegeben
 * - Fehler-Responses enthalten ein JSON-Objekt mit optionalem 'error'-Feld
 * - FormData-Bodies duerfen KEINEN Content-Type-Header bekommen (Browser setzt Boundary automatisch)
 *
 * @aenderungshinweise
 * - Bei Aenderung der Auth-Strategie (z.B. Refresh-Tokens) muss der 401-Handler angepasst werden
 * - Neue HTTP-Methoden koennen einfach im exportierten api-Objekt ergaenzt werden
 * - Die downloadBlob-Funktion unterstuetzt sowohl UTF-8- als auch ASCII-Dateinamen im Content-Disposition-Header
 */

const API_BASE = import.meta.env.VITE_API_URL;

// API-Basispfad: Falls VITE_API_URL gesetzt ist (z.B. in Entwicklung), wird diese verwendet.
// Andernfalls wird der relative Pfad '/api' genutzt (z.B. hinter einem Reverse-Proxy in Produktion).
const API = API_BASE
  ? `${API_BASE}/api`
  : '/api';

/**
 * Generische Request-Funktion fuer alle API-Aufrufe.
 * Fuegt automatisch den JWT-Bearer-Token hinzu, sofern im localStorage vorhanden.
 * Bei FormData-Bodies wird bewusst kein Content-Type gesetzt, damit der Browser
 * den korrekten multipart/form-data-Header mit Boundary erzeugt.
 */
async function request<T>(endpoint: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // FormData braucht keinen expliziten Content-Type – der Browser setzt ihn mit Boundary
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${endpoint}`, { ...opts, headers });

  // Automatisches Logout bei abgelaufenem oder ungueltigem Token
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Nicht authentifiziert');
  }
  // 204 No Content: z.B. bei erfolgreichen DELETE-Operationen ohne Response-Body
  if (res.status === 204) return undefined as T;

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Fehler');
  return data;
}

/**
 * Laedt eine Datei als Blob vom Backend herunter und loest einen Browser-Download aus.
 * Extrahiert den Dateinamen aus dem Content-Disposition-Header (UTF-8 oder ASCII-Variante).
 * Wird primaer vom documentService fuer Dokument-Downloads verwendet.
 */
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

  // Dateinamen-Extraktion: UTF-8-Variante (RFC 5987) hat Vorrang vor einfacher ASCII-Variante
  const disposition = res.headers.get('Content-Disposition') || '';
  let filename = 'download';
  const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/);
  const asciiMatch = disposition.match(/filename="(.+?)"/);
  if (utf8Match) filename = decodeURIComponent(utf8Match[1]);
  else if (asciiMatch) filename = asciiMatch[1];

  // Programmatischer Download: Erstellt temporaeren <a>-Link, klickt ihn und raeumt auf
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

/** Oeffentliche API-Schnittstelle – wird von allen Service-Modulen importiert */
export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) => request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) => request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  downloadBlob: (url: string) => downloadBlob(url),
};
