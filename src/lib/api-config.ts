/**
 * API & WebSocket Host Configuration for J.A.R.V.I.S.
 * Ensures seamless operation whether running in browser or Tauri desktop release mode.
 */

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.origin.includes('tauri') ||
    window.location.protocol === 'file:' ||
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.port === '' ||
    window.location.port === '80'
  );
}

export function getBackendBaseUrl(): string {
  if (isTauriEnvironment()) {
    return 'http://127.0.0.1:3000';
  }
  return '';
}

export function getWsUrl(path: string = '/live'): string {
  if (typeof window === 'undefined') return `ws://127.0.0.1:3000${path}`;
  if (isTauriEnvironment()) {
    return `ws://127.0.0.1:3000${path}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

// Auto-patch window.fetch in Tauri environment to route relative paths to local backend
if (typeof window !== 'undefined' && isTauriEnvironment()) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/')) {
      return originalFetch(`http://127.0.0.1:3000${input}`, init);
    }
    return originalFetch(input, init);
  };
}
