import fs from 'fs';
import path from 'path';
import { logServer } from '../core/logger';
import { configRepo } from '../db/db';
import { setGlobalGoogleAccessToken } from '../utils/workspace_tools';

export interface GoogleAuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  email?: string;
  name?: string;
  picture?: string;
  scope?: string;
  updatedAt: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const TOKEN_FILE_PATH = path.join(DATA_DIR, 'google_auth.json');
const CONFIG_KEY = 'google_oauth_credentials';

export class GoogleAuthService {
  private static instance: GoogleAuthService;
  private authData: GoogleAuthData | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  public static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService();
    }
    return GoogleAuthService.instance;
  }

  constructor() {
    this.loadPersistedAuth();
  }

  /**
   * Load credentials from SQLite configs table or fallback JSON file
   */
  public loadPersistedAuth(): GoogleAuthData | null {
    try {
      // 1. Try SQLite configs table
      const storedConfig = configRepo.get<GoogleAuthData>(CONFIG_KEY);
      if (storedConfig?.accessToken) {
        this.authData = storedConfig;
        try {
          if (typeof setGlobalGoogleAccessToken === 'function') {
            setGlobalGoogleAccessToken(storedConfig.accessToken);
          }
        } catch {}
        logServer.info(`Loaded persistent Google credentials for: ${storedConfig.email || 'user'}`);
        return this.authData;
      }

      // 2. Try JSON file fallback
      if (fs.existsSync(TOKEN_FILE_PATH)) {
        const raw = fs.readFileSync(TOKEN_FILE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as GoogleAuthData;
        if (parsed?.accessToken) {
          this.authData = parsed;
          configRepo.set(CONFIG_KEY, parsed);
          try {
            if (typeof setGlobalGoogleAccessToken === 'function') {
              setGlobalGoogleAccessToken(parsed.accessToken);
            }
          } catch {}
          logServer.info(`Loaded persistent Google credentials from file for: ${parsed.email || 'user'}`);
          return this.authData;
        }
      }

      // 3. Try process.env fallback
      if (process.env.GOOGLE_ACCESS_TOKEN) {
        const token = process.env.GOOGLE_ACCESS_TOKEN.trim();
        this.authData = {
          accessToken: token,
          updatedAt: Date.now(),
        };
        setGlobalGoogleAccessToken(token);
        return this.authData;
      }
    } catch (err: any) {
      logServer.warn(`Could not load persistent Google credentials: ${err.message}`);
    }

    return null;
  }

  /**
   * Persist auth data to SQLite and JSON file
   */
  public async saveAuth(data: Partial<GoogleAuthData>): Promise<GoogleAuthData> {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const current = this.authData || {
      accessToken: '',
      updatedAt: Date.now(),
    };

    const updated: GoogleAuthData = {
      ...current,
      ...data,
      accessToken: (data.accessToken || current.accessToken || '').trim(),
      updatedAt: Date.now(),
    };

    this.authData = updated;

    // Save to SQLite
    configRepo.set(CONFIG_KEY, updated);

    // Save to file
    try {
      fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err: any) {
      logServer.warn(`Could not write google_auth.json: ${err.message}`);
    }

    // Set globally in workspace_tools
    if (updated.accessToken) {
      setGlobalGoogleAccessToken(updated.accessToken);
    }

    // Attempt to fetch profile info if missing
    if (updated.accessToken && (!updated.email || !updated.name)) {
      this.fetchAndCacheProfile(updated.accessToken).catch(() => {});
    }

    return updated;
  }

  /**
   * Fetch user info from Google userinfo endpoint
   */
  public async fetchAndCacheProfile(token: string): Promise<any> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const profile = await res.json();
        if (this.authData) {
          this.authData.email = profile.email || this.authData.email;
          this.authData.name = profile.name || this.authData.name;
          this.authData.picture = profile.picture || this.authData.picture;
          configRepo.set(CONFIG_KEY, this.authData);
          try {
            fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(this.authData, null, 2), 'utf-8');
          } catch {}
        }
        return profile;
      }
    } catch (err: any) {
      logServer.debug(`Profile fetch skipped: ${err.message}`);
    }
    return null;
  }

  /**
   * Get currently valid access token, auto-refreshing if expired or near expiration
   */
  public async getValidToken(): Promise<string | null> {
    if (!this.authData?.accessToken) {
      this.loadPersistedAuth();
    }

    if (!this.authData?.accessToken) {
      return null;
    }

    // Check expiration if we have an expiresAt timestamp (with 3-minute safety buffer)
    const now = Date.now();
    const isExpired = this.authData.expiresAt ? now >= this.authData.expiresAt - 180000 : false;

    if (isExpired && this.authData.refreshToken) {
      logServer.info('Google access token is near expiration or expired. Auto-refreshing...');
      const newToken = await this.refreshAccessToken();
      if (newToken) return newToken;
    }

    return this.authData.accessToken;
  }

  /**
   * Refresh the access token using the stored refresh_token
   */
  public async refreshAccessToken(): Promise<string | null> {
    if (!this.authData?.refreshToken) {
      logServer.warn('Cannot refresh Google token: No refresh_token stored.');
      return null;
    }

    // Deduplicate in-flight refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const clientId = process.env.VITE_GOOGLE_CLIENT_ID || '791977848384-q4ljrlj38kepp2crruo4i6vq3j1813ot.apps.googleusercontent.com';
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.authData!.refreshToken!,
          grant_type: 'refresh_token',
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });

        if (!res.ok) {
          const errText = await res.text();
          logServer.error(`Google token refresh failed (HTTP ${res.status}): ${errText}`);
          return null;
        }

        const data = await res.json();
        const newAccessToken = data.access_token;
        const expiresInSec = data.expires_in || 3600;
        const expiresAt = Date.now() + expiresInSec * 1000;

        await this.saveAuth({
          accessToken: newAccessToken,
          expiresAt,
          scope: data.scope || this.authData?.scope,
        });

        logServer.info(`Google token auto-refreshed successfully (valid for ${expiresInSec}s).`);
        return newAccessToken;
      } catch (err: any) {
        logServer.error(`Exception while refreshing Google access token: ${err.message}`);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Exchange an OAuth authorization code for access and refresh tokens
   */
  public async exchangeAuthCode(code: string, redirectUri: string): Promise<GoogleAuthData> {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID || '791977848384-q4ljrlj38kepp2crruo4i6vq3j1813ot.apps.googleusercontent.com';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';

    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google token exchange failed (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    const expiresInSec = data.expires_in || 3600;

    const saved = await this.saveAuth({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.authData?.refreshToken,
      expiresAt: Date.now() + expiresInSec * 1000,
      scope: data.scope,
    });

    return saved;
  }

  /**
   * Disconnect and clear credentials
   */
  public disconnect(): void {
    this.authData = null;
    configRepo.delete(CONFIG_KEY);
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      try {
        fs.unlinkSync(TOKEN_FILE_PATH);
      } catch {}
    }
    setGlobalGoogleAccessToken('');
    logServer.info('Google Workspace credentials disconnected and cleared.');
  }

  /**
   * Get current connection status
   */
  public getStatus() {
    if (!this.authData?.accessToken) {
      this.loadPersistedAuth();
    }

    const isConnected = !!this.authData?.accessToken;
    const now = Date.now();
    const isExpired = this.authData?.expiresAt ? now >= this.authData.expiresAt : false;

    return {
      connected: isConnected,
      hasToken: isConnected,
      hasRefreshToken: !!this.authData?.refreshToken,
      token: this.authData?.accessToken || '',
      email: this.authData?.email || '',
      name: this.authData?.name || '',
      picture: this.authData?.picture || '',
      expiresAt: this.authData?.expiresAt,
      isExpired,
      updatedAt: this.authData?.updatedAt,
    };
  }
}

export const googleAuthService = GoogleAuthService.getInstance();
