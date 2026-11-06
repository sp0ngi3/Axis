const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = configuredApiBaseUrl === 'same-origin'
  ? ''
  : configuredApiBaseUrl ?? 'http://localhost:8081';

const transientStatuses = new Set([408, 425, 429, 502, 503, 504]);

function delay(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? 'GET';
  const attempts = method === 'GET' || method === 'HEAD' ? 3 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!transientStatuses.has(response.status) || attempt === attempts - 1) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
    }

    await delay(250 * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new Error('Axis could not connect to the local API.');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithRetry(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function upload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function download(path: string, fallbackName: string) {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(await response.text() || `Request failed: ${response.status}`);
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8''|\")?([^\";]+)/i.exec(disposition);
  return { fileName: decodeURIComponent(match?.[1] ?? fallbackName), blob: await response.blob() };
}

async function waitUntilReady<T>(timeoutMilliseconds = 60000): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMilliseconds) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store' });
      if (response.ok) return response.json() as Promise<T>;
      lastError = new Error(`Axis API is starting: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(750);
  }

  throw lastError instanceof Error ? lastError : new Error('Axis API did not become ready in time.');
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  backupDownloadUrl: () => `${API_BASE_URL}/api/backup/export`,
  waitUntilReady,
  download,
  validateBackup: <T>(file: File) => upload<T>('/api/backup/validate', file),
  importBackup: <T>(file: File) => upload<T>('/api/backup/import', file)
};
