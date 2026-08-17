import { logTool, logServer } from '../core/logger';
import { configRepo, auditRepo } from '../db/db';

const CONFIG_KEY = 'github_auth';

export interface GitHubAuthData {
  accessToken: string;
  tokenType?: string;
  scope?: string;
  login?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  htmlUrl?: string;
  publicRepos?: number;
  updatedAt?: number;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  htmlUrl: string;
  isPrivate: boolean;
  stargazersCount: number;
  forksCount: number;
  language?: string;
  updatedAt: string;
}

export interface GitHubIssueResult {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  state: string;
  createdAt: string;
}

export interface GitHubGistResult {
  id: string;
  htmlUrl: string;
  description?: string;
  createdAt: string;
}

export class GitHubService {
  private static instance: GitHubService;
  private authData: GitHubAuthData | null = null;

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  constructor() {
    this.loadPersistedAuth();
  }

  /**
   * Load saved GitHub credentials from SQLite or environment
   */
  public loadPersistedAuth(): GitHubAuthData | null {
    try {
      const persisted = configRepo.get<GitHubAuthData>(CONFIG_KEY);
      if (persisted && persisted.accessToken) {
        this.authData = persisted;
        logServer.info(`[GitHubService] Loaded persisted credentials for @${persisted.login || persisted.name || 'user'}`);
        return persisted;
      }
    } catch (err: any) {
      logTool.debug(`[GitHubService] Could not load SQLite auth: ${err.message}`);
    }

    const envToken = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (envToken) {
      this.authData = { accessToken: envToken.trim() };
      return this.authData;
    }

    return null;
  }

  /**
   * Save OAuth access token and user metadata to SQLite
   */
  public async saveAuth(auth: Partial<GitHubAuthData>): Promise<GitHubAuthData> {
    const current = this.loadPersistedAuth() || { accessToken: '' };
    const merged: GitHubAuthData = {
      ...current,
      ...auth,
      accessToken: (auth.accessToken || current.accessToken || '').trim(),
      updatedAt: Date.now(),
    };

    if (merged.accessToken) {
      try {
        const userInfo = await this.fetchApiUser(merged.accessToken);
        if (userInfo) {
          merged.login = userInfo.login || merged.login;
          merged.name = userInfo.name || merged.name;
          merged.email = userInfo.email || merged.email;
          merged.avatarUrl = userInfo.avatar_url || merged.avatarUrl;
          merged.htmlUrl = userInfo.html_url || merged.htmlUrl;
          merged.publicRepos = userInfo.public_repos ?? merged.publicRepos;
        }
      } catch (e: any) {
        logTool.debug(`[GitHubService] Auto-enrich user info notice: ${e.message}`);
      }
    }

    this.authData = merged;
    configRepo.set(CONFIG_KEY, merged);
    logServer.info(`[GitHubService] Saved GitHub credentials in SQLite (@${merged.login || merged.name || 'connected'})`);
    auditRepo.log('GITHUB', 'info', 'GitHub credentials updated', { login: merged.login, email: merged.email });
    return merged;
  }

  /**
   * Disconnect GitHub credentials
   */
  public disconnect(): void {
    this.authData = null;
    configRepo.delete(CONFIG_KEY);
    logServer.info('[GitHubService] GitHub credentials disconnected.');
    auditRepo.log('GITHUB', 'info', 'GitHub credentials disconnected');
  }

  /**
   * Get current auth status
   */
  public getStatus(): {
    connected: boolean;
    login?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
    publicRepos?: number;
  } {
    const auth = this.authData || this.loadPersistedAuth();
    return {
      connected: !!auth?.accessToken,
      login: auth?.login,
      name: auth?.name,
      email: auth?.email,
      avatarUrl: auth?.avatarUrl,
      publicRepos: auth?.publicRepos,
    };
  }

  public getAccessToken(): string {
    return this.authData?.accessToken || this.loadPersistedAuth()?.accessToken || process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN || '';
  }

  /**
   * Generate GitHub OAuth 2.0 Authorization URL
   */
  public getAuthorizationUrl(redirectUri?: string, clientId?: string, state?: string): string {
    const id = (clientId || process.env.GITHUB_CLIENT_ID || '').trim();
    if (!id) {
      throw new Error('GitHub Client ID is missing. Please configure GITHUB_CLIENT_ID in .env or settings.');
    }
    const stateToken = state || `jarvis_gh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const scopes = ['repo', 'read:user', 'user:email', 'workflow', 'gist'];
    const paramObj: Record<string, string> = {
      client_id: id,
      state: stateToken,
      scope: scopes.join(' '),
      allow_signup: 'true',
    };
    const uri = redirectUri || process.env.GITHUB_REDIRECT_URI;
    if (uri && uri !== 'auto' && uri !== 'none') {
      paramObj.redirect_uri = uri;
    }
    const params = new URLSearchParams(paramObj);
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for GitHub access token
   */
  public async exchangeAuthCode(
    code: string,
    redirectUri: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<GitHubAuthData> {
    const id = (clientId || process.env.GITHUB_CLIENT_ID || '').trim();
    const secret = (clientSecret || process.env.GITHUB_CLIENT_SECRET || '').trim();

    if (!id || !secret) {
      throw new Error('GitHub Client ID and Client Secret are required for code exchange.');
    }

    const body = new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: redirectUri,
    });

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'JARVIS-OS/1.0',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub token exchange failed (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`GitHub token error: ${data.error_description || data.error}`);
    }

    const accessToken = data.access_token;
    if (!accessToken) {
      throw new Error('Invalid response from GitHub: missing access_token');
    }

    const saved = await this.saveAuth({
      accessToken,
      tokenType: data.token_type,
      scope: data.scope,
    });

    return saved;
  }

  private async fetchApiUser(token: string): Promise<any> {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'JARVIS-OS/1.0',
      },
    });
    if (res.ok) {
      return res.json();
    }
    throw new Error(`GitHub User API returned HTTP ${res.status}`);
  }

  /**
   * 1. Get Authenticated User Profile
   */
  public async getMyProfile(): Promise<any> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('GitHub is not connected. Please provide an OAuth token or run github_oauth_flow.py');
    }
    return this.fetchApiUser(token);
  }

  /**
   * 2. List Authenticated User Repositories
   */
  public async listMyRepos(limit = 10, sort: 'updated' | 'created' | 'pushed' = 'updated'): Promise<GitHubRepoItem[]> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'JARVIS-OS/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`https://api.github.com/user/repos?sort=${sort}&per_page=${limit}&affiliation=owner,collaborator`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to list repositories (HTTP ${res.status})`);
    }

    const repos = await res.json();
    return repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      htmlUrl: r.html_url,
      isPrivate: r.private,
      stargazersCount: r.stargazers_count,
      forksCount: r.forks_count,
      language: r.language,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * 3. Create an Issue on a Repository
   */
  public async createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]): Promise<GitHubIssueResult> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('GitHub write permissions require an authenticated OAuth token.');
    }

    const payload: any = { title, body: body || '' };
    if (labels && labels.length > 0) payload.labels = labels;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'JARVIS-OS/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub create issue failed (HTTP ${res.status}): ${err}`);
    }

    const data = await res.json();
    logTool.info(`[GitHubService] Created issue #${data.number} on ${owner}/${repo}`);
    auditRepo.log('GITHUB', 'info', `Issue #${data.number} created on ${owner}/${repo}`, { url: data.html_url });

    return {
      id: data.id,
      number: data.number,
      title: data.title,
      htmlUrl: data.html_url,
      state: data.state,
      createdAt: data.created_at,
    };
  }

  /**
   * 4. Create a Gist
   */
  public async createGist(description: string, filename: string, content: string, isPublic = false): Promise<GitHubGistResult> {
    const token = this.getAccessToken();
    if (!token) {
      throw new Error('Gist creation requires GitHub OAuth credentials.');
    }

    const payload = {
      description,
      public: isPublic,
      files: {
        [filename]: { content },
      },
    };

    const res = await fetch('https://api.github.com/gists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'JARVIS-OS/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create Gist (HTTP ${res.status}): ${err}`);
    }

    const data = await res.json();
    logTool.info(`[GitHubService] Created gist: ${data.html_url}`);
    auditRepo.log('GITHUB', 'info', 'GitHub gist created', { url: data.html_url });

    return {
      id: data.id,
      htmlUrl: data.html_url,
      description: data.description,
      createdAt: data.created_at,
    };
  }

  /**
   * 5. Get Repository Details (with resilient public fallback)
   */
  public async getRepoDetails(owner: string, repo: string): Promise<any> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'JARVIS-OS/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok && res.status === 401 && token) {
      // Fallback without invalid auth header for public repositories
      res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'JARVIS-OS/1.0' },
      });
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch repo ${owner}/${repo} (HTTP ${res.status})`);
    }
    return res.json();
  }

  /**
   * 6. Search Repositories (Authenticated with 5000 req/hr rate limit + fallback)
   */
  public async searchRepositories(query: string, limit = 5): Promise<GitHubRepoItem[]> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'JARVIS-OS/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${limit}`, { headers });
    if (!res.ok && res.status === 401 && token) {
      res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${limit}`, {
        headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'JARVIS-OS/1.0' },
      });
    }

    if (!res.ok) {
      throw new Error(`GitHub search failed (HTTP ${res.status})`);
    }

    const data = await res.json();
    return (data.items || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      htmlUrl: r.html_url,
      isPrivate: r.private,
      stargazersCount: r.stargazers_count,
      forksCount: r.forks_count,
      language: r.language,
      updatedAt: r.updated_at,
    }));
  }
}

export const githubService = GitHubService.getInstance();
