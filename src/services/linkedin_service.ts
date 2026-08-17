import { exec } from 'child_process';
import { promisify } from 'util';
import { logTool, logServer } from '../core/logger';
import { configRepo, auditRepo } from '../db/db';
import { eventBus } from '../core/event_bus';

const execAsync = promisify(exec);

const CONFIG_KEY = 'linkedin_auth';

export interface LinkedInAuthData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  userUrn?: string;
  name?: string;
  email?: string;
  picture?: string;
  headline?: string;
  linkedApiToken?: string;
  identificationToken?: string;
}

export interface LinkedInProfile {
  name: string;
  headline?: string;
  userUrn?: string;
  email?: string;
  picture?: string;
  vanityName?: string;
  location?: string;
  about?: string;
  experience?: Array<{ title: string; company: string; duration?: string; description?: string }>;
  education?: Array<{ school: string; degree?: string; fieldOfStudy?: string }>;
  skills?: string[];
  recentPosts?: Array<{ text: string; date?: string; url?: string }>;
  source: 'official_oauth' | 'linkedin_cli' | 'jina_reader' | 'jina_search' | 'synthesized';
}

export interface LinkedInCompany {
  name: string;
  vanityName?: string;
  tagline?: string;
  description?: string;
  industry?: string;
  website?: string;
  headquarters?: string;
  companySize?: string;
  followersCount?: number;
  url: string;
  source: string;
}

export interface LinkedInSearchResultItem {
  name: string;
  headline?: string;
  location?: string;
  url: string;
  currentCompany?: string;
  position?: string;
}

export interface LinkedInJobItem {
  title: string;
  company: string;
  location: string;
  url: string;
  postedDate?: string;
  descriptionSnippet?: string;
}

export class LinkedInService {
  private static instance: LinkedInService;
  private authData: LinkedInAuthData | null = null;

  public static getInstance(): LinkedInService {
    if (!LinkedInService.instance) {
      LinkedInService.instance = new LinkedInService();
    }
    return LinkedInService.instance;
  }

  constructor() {
    this.loadPersistedAuth();
  }

  /**
   * Load saved LinkedIn credentials from SQLite
   */
  public loadPersistedAuth(): LinkedInAuthData | null {
    try {
      const persisted = configRepo.get<LinkedInAuthData>(CONFIG_KEY);
      if (persisted && (persisted.accessToken || persisted.linkedApiToken)) {
        this.authData = persisted;
        logServer.info(`[LinkedInService] Loaded persisted credentials for ${persisted.name || persisted.email || 'authenticated user'}`);
        return persisted;
      }
    } catch (err: any) {
      logServer.warn(`[LinkedInService] Error loading persisted auth: ${err.message}`);
    }
    return null;
  }

  /**
   * Save OAuth access token and user metadata
   */
  public async saveAuth(auth: Partial<LinkedInAuthData>): Promise<LinkedInAuthData> {
    const current = this.loadPersistedAuth() || { accessToken: '' };
    const merged: LinkedInAuthData = {
      ...current,
      ...auth,
      accessToken: (auth.accessToken || current.accessToken || '').trim(),
    };

    // If access token is provided, fetch latest profile info to enrich metadata
    if (merged.accessToken) {
      try {
        const profile = await this.fetchOAuthUserInfo(merged.accessToken);
        if (profile) {
          merged.name = profile.name || merged.name;
          merged.email = profile.email || merged.email;
          merged.picture = profile.picture || merged.picture;
          merged.userUrn = profile.userUrn || merged.userUrn;
        }
      } catch (e: any) {
        logTool.debug(`[LinkedInService] Could not auto-enrich user info from token: ${e.message}`);
      }
    }

    this.authData = merged;
    configRepo.set(CONFIG_KEY, merged);
    logServer.info(`[LinkedInService] Saved LinkedIn credentials in SQLite (User: ${merged.name || merged.email || 'connected'})`);
    auditRepo.log('LINKEDIN', 'info', 'LinkedIn credentials updated', { email: merged.email, userUrn: merged.userUrn });
    return merged;
  }

  /**
   * Disconnect LinkedIn credentials
   */
  public disconnect(): void {
    this.authData = null;
    configRepo.delete(CONFIG_KEY);
    logServer.info('[LinkedInService] LinkedIn credentials disconnected.');
    auditRepo.log('LINKEDIN', 'info', 'LinkedIn credentials disconnected');
  }

  /**
   * Get current auth status
   */
  public getStatus(): {
    connected: boolean;
    hasAccessToken: boolean;
    hasLinkedApiToken: boolean;
    name?: string;
    email?: string;
    picture?: string;
    userUrn?: string;
  } {
    const auth = this.authData || this.loadPersistedAuth();
    return {
      connected: !!(auth?.accessToken || auth?.linkedApiToken),
      hasAccessToken: !!auth?.accessToken,
      hasLinkedApiToken: !!auth?.linkedApiToken,
      name: auth?.name,
      email: auth?.email,
      picture: auth?.picture,
      userUrn: auth?.userUrn,
    };
  }

  public getAccessToken(): string {
    return this.authData?.accessToken || this.loadPersistedAuth()?.accessToken || process.env.LINKEDIN_ACCESS_TOKEN || '';
  }

  /**
   * Generate LinkedIn OAuth 2.0 Authorization URL
   */
  public getAuthorizationUrl(redirectUri: string, clientId?: string, state?: string): string {
    const id = (clientId || process.env.LINKEDIN_CLIENT_ID || '').trim();
    if (!id) {
      throw new Error('LinkedIn Client ID is missing. Please configure LINKEDIN_CLIENT_ID in .env or settings.');
    }
    const stateToken = state || `jarvis_li_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const scopes = ['openid', 'profile', 'email', 'w_member_social'];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: id,
      redirect_uri: redirectUri,
      state: stateToken,
      scope: scopes.join(' '),
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for LinkedIn access token
   */
  public async exchangeAuthCode(
    code: string,
    redirectUri: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<LinkedInAuthData> {
    const id = (clientId || process.env.LINKEDIN_CLIENT_ID || '').trim();
    const secret = (clientSecret || process.env.LINKEDIN_CLIENT_SECRET || '').trim();

    if (!id || !secret) {
      throw new Error('LinkedIn Client ID and Client Secret are required for code exchange.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: id,
      client_secret: secret,
    });

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LinkedIn token exchange failed (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    const accessToken = data.access_token;
    if (!accessToken) {
      throw new Error('Invalid response from LinkedIn: missing access_token');
    }

    const saved = await this.saveAuth({
      accessToken,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    });

    return saved;
  }

  /**
   * 1. Fetch OpenID / OAuth2 User Profile (`/v2/userinfo` or `/v2/me`)
   */
  private async fetchOAuthUserInfo(token: string): Promise<{ name: string; email?: string; picture?: string; userUrn?: string } | null> {
    try {
      // 1. Try standard OpenID UserInfo endpoint
      const res = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (res.ok) {
        const data = await res.json();
        return {
          name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
          email: data.email,
          picture: data.picture,
          userUrn: data.sub ? `urn:li:person:${data.sub}` : undefined,
        };
      }
    } catch (e: any) {
      logTool.debug(`[LinkedInService] /v2/userinfo fallback: ${e.message}`);
    }

    try {
      // 2. Try `/v2/me` fallback
      const resMe = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      if (resMe.ok) {
        const me = await resMe.json();
        const firstName = me.localizedFirstName || me.firstName?.localized?.en_US || '';
        const lastName = me.localizedLastName || me.lastName?.localized?.en_US || '';
        return {
          name: `${firstName} ${lastName}`.trim(),
          userUrn: me.id ? `urn:li:person:${me.id}` : undefined,
        };
      }
    } catch {}

    return null;
  }

  /**
   * 2. Get Authenticated User Profile
   */
  public async getMyProfile(): Promise<LinkedInProfile> {
    const token = this.getAccessToken();
    if (token) {
      const userInfo = await this.fetchOAuthUserInfo(token);
      if (userInfo) {
        return {
          name: userInfo.name || 'LinkedIn User',
          email: userInfo.email,
          picture: userInfo.picture,
          userUrn: userInfo.userUrn,
          source: 'official_oauth',
        };
      }
    }

    // Try CLI
    try {
      const { stdout } = await execAsync('linkedin person fetch me --json -q', { timeout: 15000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success && parsed.data) {
          return {
            ...parsed.data,
            source: 'linkedin_cli',
          };
        }
      }
    } catch {}

    throw new Error('LinkedIn account not connected. Please provide an OAuth access token or LinkedAPI tokens.');
  }

  /**
   * 3. Create a LinkedIn Post / Share Update
   */
  public async createPost(
    text: string,
    visibility: 'PUBLIC' | 'CONNECTIONS' = 'PUBLIC'
  ): Promise<{ success: boolean; postId?: string; postUrl?: string; message: string }> {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Post content cannot be empty.');
    }

    const token = this.getAccessToken();
    let authorUrn = this.authData?.userUrn;

    if (token) {
      // If we don't have authorUrn, fetch it
      if (!authorUrn) {
        const userInfo = await this.fetchOAuthUserInfo(token);
        authorUrn = userInfo?.userUrn;
      }

      if (!authorUrn) {
        authorUrn = 'urn:li:person:me';
      }

      // 1. Try LinkedIn UGC Posts API (`/v2/ugcPosts`)
      try {
        const postPayload = {
          author: authorUrn.startsWith('urn:') ? authorUrn : `urn:li:person:${authorUrn}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: cleanText,
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
          },
        };

        const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(postPayload),
        });

        if (res.ok) {
          const data = await res.json();
          const postId = data.id || '';
          logTool.info(`[LinkedInService] Created LinkedIn post via official UGC API: ${postId}`);
          auditRepo.log('LINKEDIN', 'info', 'LinkedIn post published via UGC API', { postId, length: cleanText.length });
          return {
            success: true,
            postId,
            postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}` : undefined,
            message: 'LinkedIn post published successfully.',
          };
        } else {
          const errText = await res.text();
          logTool.debug(`[LinkedInService] UGC API returned ${res.status}: ${errText}. Trying Rest Posts API...`);
        }
      } catch (ugcErr: any) {
        logTool.debug(`[LinkedInService] UGC API error: ${ugcErr.message}`);
      }

      // 2. Try Modern REST Posts API (`/rest/posts`)
      try {
        const restPayload = {
          author: authorUrn.startsWith('urn:') ? authorUrn : `urn:li:person:${authorUrn}`,
          commentary: cleanText,
          visibility: visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        };

        const resRest = await fetch('https://api.linkedin.com/rest/posts', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'LinkedIn-Version': '202401',
            'X-Restli-Protocol-Version': '2.0.0',
          },
          body: JSON.stringify(restPayload),
        });

        if (resRest.ok || resRest.status === 201) {
          const postId = resRest.headers.get('x-restli-id') || 'published';
          logTool.info(`[LinkedInService] Created LinkedIn post via REST API: ${postId}`);
          auditRepo.log('LINKEDIN', 'info', 'LinkedIn post published via REST API', { postId });
          return {
            success: true,
            postId,
            postUrl: `https://www.linkedin.com/feed/update/${postId}`,
            message: 'LinkedIn post published successfully.',
          };
        }
      } catch (restErr: any) {
        logTool.debug(`[LinkedInService] REST Posts API error: ${restErr.message}`);
      }
    }

    // 3. Try `linkedin-cli` fallback
    try {
      const sanitized = cleanText.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(`linkedin post create '${sanitized}' --json -q`, { timeout: 30000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success) {
          return {
            success: true,
            postId: parsed.data?.id || parsed.data?.postUrl,
            postUrl: parsed.data?.postUrl,
            message: 'LinkedIn post created via LinkedIn CLI.',
          };
        }
      }
    } catch {}

    throw new Error('Failed to create LinkedIn post. Verify OAuth token has "w_member_social" permission or configure LinkedIn CLI.');
  }

  /**
   * 4. Fetch Any Person Profile with Work Experience & Education
   */
  public async fetchPersonProfile(profileUrlOrUsername: string, sections: string[] = ['experience', 'education']): Promise<LinkedInProfile> {
    const rawTarget = profileUrlOrUsername.trim();
    const cleanUrl = rawTarget.startsWith('http')
      ? rawTarget
      : `https://www.linkedin.com/in/${rawTarget.replace(/^@/, '')}`;

    logTool.info(`[LinkedInService] Fetching profile for: ${cleanUrl}`);

    // 1. Try `linkedin-cli` if configured
    try {
      const flags = sections.map((s) => `--${s}`).join(' ');
      const { stdout } = await execAsync(`linkedin person fetch "${cleanUrl}" ${flags} --json -q`, { timeout: 30000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success && parsed.data) {
          return {
            ...parsed.data,
            source: 'linkedin_cli',
          };
        }
      }
    } catch {}

    // 2. High-Fidelity Jina Reader Fallback (Zero-config public profile extraction)
    try {
      const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
      const res = await fetch(jinaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'X-Return-Format': 'markdown',
        },
      });

      if (res.ok) {
        const markdown = await res.text();
        const titleMatch = markdown.match(/^#\s+(.+)$/m) || markdown.match(/Title:\s*([^\n]+)/);
        const name = titleMatch ? titleMatch[1].replace(/\|\s*LinkedIn/i, '').trim() : cleanUrl;

        // Parse Experience & Education from markdown sections
        const experience: Array<{ title: string; company: string; duration?: string; description?: string }> = [];
        const expSection = markdown.match(/(?:##\s*Experience|Experience)([\s\S]*?)(?:##\s*Education|##\s*Skills|$)/i);
        if (expSection) {
          const lines = expSection[1].split('\n').filter((l) => l.trim().length > 0);
          for (let i = 0; i < Math.min(lines.length, 6); i++) {
            if (lines[i].startsWith('###') || lines[i].startsWith('-') || lines[i].startsWith('*')) {
              experience.push({
                title: lines[i].replace(/^[#\-\*\s]+/, '').trim(),
                company: lines[i + 1] ? lines[i + 1].replace(/^[#\-\*\s]+/, '').trim() : 'Company',
              });
              i++;
            }
          }
        }

        return {
          name,
          headline: markdown.slice(0, 300).split('\n').find((l) => l.length > 10 && !l.startsWith('#')) || 'Professional Profile',
          about: markdown.slice(0, 1500),
          experience: experience.length > 0 ? experience : undefined,
          source: 'jina_reader',
        };
      }
    } catch (e: any) {
      logTool.warn(`[LinkedInService] Jina Reader fallback error: ${e.message}`);
    }

    // 3. Fallback: Search for person summary
    try {
      const targetSlug = cleanUrl.split('/').pop() || cleanUrl;
      const searchRes = await fetch(`https://s.jina.ai/${encodeURIComponent('site:linkedin.com/in/ ' + targetSlug)}`, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0', 'X-Return-Format': 'markdown' },
      });
      if (searchRes.ok) {
        const md = await searchRes.text();
        const titleMatch = md.match(/(?:Title:\s*|\[\d+\]\s*|##\s*)([^\n]+)/);
        const name = titleMatch ? titleMatch[1].replace(/\|\s*LinkedIn/i, '').trim() : targetSlug;
        return {
          name,
          headline: md.slice(0, 200).replace(/https?:\/\/[^\s\)]+/g, '').trim(),
          about: md.slice(0, 1000),
          source: 'jina_search',
        };
      }
    } catch {}

    return {
      name: cleanUrl.split('/').pop() || 'LinkedIn Professional',
      headline: 'LinkedIn Professional Profile',
      source: 'synthesized',
    };
  }

  /**
   * 5. Fetch Company Profile & Overview
   */
  public async fetchCompany(companyUrlOrName: string): Promise<LinkedInCompany> {
    const raw = companyUrlOrName.trim();
    const cleanUrl = raw.startsWith('http')
      ? raw
      : `https://www.linkedin.com/company/${encodeURIComponent(raw)}`;

    logTool.info(`[LinkedInService] Fetching company profile for: ${cleanUrl}`);

    // Try `linkedin-cli`
    try {
      const { stdout } = await execAsync(`linkedin company fetch "${cleanUrl}" --json -q`, { timeout: 30000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success && parsed.data) {
          return {
            name: parsed.data.name || raw,
            tagline: parsed.data.tagline,
            description: parsed.data.description,
            industry: parsed.data.industry,
            website: parsed.data.website,
            headquarters: parsed.data.headquarters,
            companySize: parsed.data.companySize,
            followersCount: parsed.data.followersCount,
            url: cleanUrl,
            source: 'linkedin_cli',
          };
        }
      }
    } catch {}

    // Fallback 1: Jina Reader
    try {
      const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
      const res = await fetch(jinaUrl, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0', 'X-Return-Format': 'markdown' },
      });
      if (res.ok) {
        const md = await res.text();
        const titleMatch = md.match(/^#\s+(.+)$/m) || md.match(/Title:\s*([^\n]+)/);
        const name = titleMatch ? titleMatch[1].replace(/\|\s*LinkedIn/i, '').trim() : raw;
        return {
          name,
          description: md.slice(0, 2000),
          url: cleanUrl,
          source: 'jina_reader',
        };
      }
    } catch {}

    // Fallback 2: Jina Search for Company
    try {
      const searchRes = await fetch(`https://s.jina.ai/${encodeURIComponent('site:linkedin.com/company/ ' + raw)}`, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0', 'X-Return-Format': 'markdown' },
      });
      if (searchRes.ok) {
        const md = await searchRes.text();
        const titleMatch = md.match(/(?:Title:\s*|\[\d+\]\s*|##\s*)([^\n]+)/);
        const name = titleMatch ? titleMatch[1].replace(/\|\s*LinkedIn/i, '').trim() : raw;
        return {
          name,
          description: md.slice(0, 1000).replace(/https?:\/\/[^\s\)]+/g, '').trim(),
          url: cleanUrl,
          source: 'jina_search',
        };
      }
    } catch {}

    return {
      name: raw,
      description: `Company profile for ${raw} on LinkedIn`,
      url: cleanUrl,
      source: 'synthesized',
    };
  }

  /**
   * 6. Search People on LinkedIn
   */
  public async searchPeople(query: {
    term?: string;
    position?: string;
    location?: string;
    limit?: number;
  }): Promise<LinkedInSearchResultItem[]> {
    const limit = query.limit || 5;

    // Try CLI
    try {
      const flags: string[] = [];
      if (query.term) flags.push(`--term "${query.term.replace(/"/g, '\\"')}"`);
      if (query.position) flags.push(`--position "${query.position.replace(/"/g, '\\"')}"`);
      if (query.location) flags.push(`--locations "${query.location.replace(/"/g, '\\"')}"`);
      flags.push(`--limit ${limit}`);

      const { stdout } = await execAsync(`linkedin person search ${flags.join(' ')} --json -q`, { timeout: 30000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success && Array.isArray(parsed.data)) {
          return parsed.data.map((p: any) => ({
            name: p.name || p.fullName || 'Professional',
            headline: p.headline,
            location: p.location,
            url: p.url || (p.username ? `https://www.linkedin.com/in/${p.username}` : ''),
            position: p.position,
            currentCompany: p.currentCompany,
          }));
        }
      }
    } catch {}

    // Fallback: Google search via Jina
    try {
      const searchQuery = `site:linkedin.com/in/ "${query.position || query.term || ''}" "${query.location || ''}"`.trim();
      const res = await fetch(`https://s.jina.ai/${encodeURIComponent(searchQuery)}`, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0', 'X-Return-Format': 'markdown' },
      });
      if (res.ok) {
        const md = await res.text();
        const results: LinkedInSearchResultItem[] = [];
        const sections = md.split(/\n(?=\[\d+\]|##\s+|Title:)/);

        for (const sec of sections) {
          if (results.length >= limit) break;
          const urlMatch = sec.match(/https:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[^\s\)\?]+/i);
          const titleMatch = sec.match(/(?:Title:\s*|\[\d+\]\s*|##\s*)([^\n]+)/);

          if (urlMatch) {
            results.push({
              name: titleMatch ? titleMatch[1].replace(/\|\s*LinkedIn/i, '').replace(/-\s*LinkedIn/i, '').trim() : 'Professional',
              headline: sec.slice(0, 200).replace(/https?:\/\/[^\s\)]+/g, '').trim(),
              url: urlMatch[0],
              location: query.location,
            });
          }
        }

        if (results.length > 0) return results;
      }
    } catch {}

    return [];
  }

  /**
   * 7. Search Jobs on LinkedIn
   */
  public async searchJobs(query: { keywords?: string; location?: string; limit?: number }): Promise<LinkedInJobItem[]> {
    const limit = query.limit || 5;
    const keywords = query.keywords || 'software engineer';
    const location = query.location || 'Remote';

    // Jina search fallback for LinkedIn jobs
    try {
      const q = `site:linkedin.com/jobs/view "${keywords}" "${location}"`;
      const res = await fetch(`https://s.jina.ai/${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0', 'X-Return-Format': 'markdown' },
      });

      if (res.ok) {
        const md = await res.text();
        const jobs: LinkedInJobItem[] = [];
        const sections = md.split(/\n(?=\[\d+\]|##\s+|Title:)/);

        for (const sec of sections) {
          if (jobs.length >= limit) break;
          const urlMatch = sec.match(/https:\/\/[a-z]{2,3}\.linkedin\.com\/jobs\/view\/[^\s\)\?]+/i);
          const titleMatch = sec.match(/(?:Title:\s*|\[\d+\]\s*|##\s*)([^\n]+)/);

          if (urlMatch) {
            jobs.push({
              title: titleMatch ? titleMatch[1].replace(/\|\s*LinkedIn/i, '').trim() : keywords,
              company: 'Company (LinkedIn)',
              location,
              url: urlMatch[0],
              descriptionSnippet: sec.slice(0, 250).replace(/https?:\/\/[^\s\)]+/g, '').trim(),
            });
          }
        }

        return jobs;
      }
    } catch {}

    return [];
  }

  /**
   * 8. Send Direct Message to a Connection
   */
  public async sendMessage(personUrl: string, message: string): Promise<{ success: boolean; message: string }> {
    const cleanMsg = message.trim();
    if (!cleanMsg) throw new Error('Message text cannot be empty');

    try {
      const sanitized = cleanMsg.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(`linkedin message send "${personUrl}" '${sanitized}' --json -q`, { timeout: 30000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success) {
          return { success: true, message: 'Message sent successfully.' };
        }
      }
    } catch (e: any) {
      throw new Error(`Failed to send LinkedIn message: ${e.message}. Note: Messaging requires active LinkedAPI setup.`);
    }

    throw new Error('Message dispatch failed.');
  }

  /**
   * 9. Send Connection Request
   */
  public async sendConnection(personUrl: string, note?: string): Promise<{ success: boolean; message: string }> {
    try {
      const noteFlag = note ? `--note '${note.replace(/'/g, "'\\''")}'` : '';
      const { stdout } = await execAsync(`linkedin connection send "${personUrl}" ${noteFlag} --json -q`, { timeout: 30000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        if (parsed.success) {
          return { success: true, message: 'Connection request sent successfully.' };
        }
      }
    } catch (e: any) {
      throw new Error(`Failed to send connection request: ${e.message}`);
    }

    throw new Error('Connection request failed.');
  }
}

export const linkedinService = LinkedInService.getInstance();
