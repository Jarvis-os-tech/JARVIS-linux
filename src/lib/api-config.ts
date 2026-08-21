/**
 * API & WebSocket Host Configuration for J.A.R.V.I.S.
 */

export function getBackendBaseUrl(): string {
  return '';
}

export function getWsUrl(path: string = '/live'): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return `ws://localhost:3000${cleanPath}`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${cleanPath}`;
}

