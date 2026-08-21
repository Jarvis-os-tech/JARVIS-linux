// URL Safety & SSRF Prevention for J.A.R.V.I.S.
// Validates URLs, blocks private/internal network IP ranges, cloud metadata endpoints,
// and localhost access unless explicitly permitted.
// Ported and enhanced from Hermes (tools/url_safety.py)

import dns from 'dns';
import { promisify } from 'util';
import { logSecurity } from './logger';

const lookupAsync = promisify(dns.lookup);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
  'metadata'
]);

export interface UrlSafetyVerdict {
  safe: boolean;
  reason?: string;
  normalizedUrl?: string;
  ip?: string;
}

/**
 * Check if an IPv4 address is in a private/loopback/link-local range.
 */
export function isPrivateIp(ip: string): boolean {
  if (ip === '127.0.0.1' || ip === '::1' || ip === '0.0.0.0') return true;

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud Metadata)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;

  return false;
}

/**
 * Validates a target URL against SSRF and private network attacks.
 */
export async function validateUrlSafety(urlStr: string, allowPrivate: boolean = false): Promise<UrlSafetyVerdict> {
  if (!urlStr || typeof urlStr !== 'string') {
    return { safe: false, reason: 'Invalid or empty URL string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: 'Malformed URL' };
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Unsupported protocol: ${parsed.protocol}. Only http: and https: are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Check blocked hostnames
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Access to blocked hostname or cloud metadata (${hostname}) is forbidden.` };
  }

  // 2. Resolve DNS and check resolved IP
  try {
    const { address } = await lookupAsync(hostname);
    if (!allowPrivate && isPrivateIp(address)) {
      logSecurity.warn(`SSRF Block: URL [${urlStr}] resolves to private IP [${address}]`);
      return {
        safe: false,
        reason: `Target URL resolves to private internal network IP (${address}).`,
        ip: address
      };
    }
    return {
      safe: true,
      normalizedUrl: parsed.href,
      ip: address
    };
  } catch (err: any) {
    return { safe: false, reason: `DNS lookup failed for ${hostname}: ${err.message}` };
  }
}
