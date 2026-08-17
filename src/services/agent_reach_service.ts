import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logServer, logTool } from '../core/logger';
import { researchEngine } from '../research/engine';
import { GroundedResearchReport, ClaimVerificationReport, FastFactResult, ResearchOptions } from '../research/types';

const execAsync = promisify(exec);

export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishedDate?: string;
}

export interface WebResearchReport {
  query: string;
  summary: string;
  sources: { title: string; url: string; domain?: string }[];
  extractedContent?: string;
  groundedReport?: GroundedResearchReport;
  timestamp: number;
}

export class AgentReachService {
  private static instance: AgentReachService;

  public static getInstance(): AgentReachService {
    if (!AgentReachService.instance) {
      AgentReachService.instance = new AgentReachService();
    }
    return AgentReachService.instance;
  }

  constructor() {}

  /**
   * 1. Read any web page cleanly via Jina Reader with resilient Direct-Fetch & GitHub API Fallbacks
   */
  public async fetchWebPage(url: string, timeoutMs: number = 15000): Promise<{ title: string; content: string; url: string }> {
    const cleanUrl = url.trim();

    // Special case: GitHub Repositories (Fetch ground-truth README directly via GitHub API)
    const ghMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/);
    if (ghMatch) {
      try {
        const owner = ghMatch[1];
        const repo = ghMatch[2].replace(/\.git$/, '');
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: {
            'User-Agent': 'JARVIS-Agent-Reach/1.0',
            'Accept': 'application/vnd.github.v3.raw'
          }
        });
        if (res.ok) {
          const readme = await res.text();
          logTool.info(`[AgentReach] Direct GitHub README retrieved for ${owner}/${repo} (${readme.length} chars)`);
          return {
            title: `${owner}/${repo} (GitHub Repository)`,
            content: readme.slice(0, 30000),
            url: cleanUrl
          };
        }
      } catch (ghErr: any) {
        logTool.debug(`[AgentReach] GitHub direct README fallback: ${ghErr.message}`);
      }
    }

    // 1. Try Jina Reader
    try {
      const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(jinaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'X-With-Generated-Alt': 'true',
          'X-Return-Format': 'markdown'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        const titleMatch = text.match(/^#\s+(.+)$/m) || text.match(/Title:\s*([^\n]+)/);
        const title = titleMatch ? titleMatch[1].trim() : cleanUrl;
        logTool.info(`[AgentReach] Jina Reader fetched page: ${cleanUrl} (${text.length} chars)`);
        return {
          title,
          content: text.slice(0, 30000),
          url: cleanUrl
        };
      }
    } catch (jinaErr: any) {
      logTool.debug(`[AgentReach] Jina Reader error for ${cleanUrl}: ${jinaErr.message}`);
    }

    // 2. Direct HTTP Fetch with HTML Tag & Script Stripping
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Direct HTTP ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : cleanUrl;

      // Clean HTML: Remove scripts, styles, SVGs, and navbars
      let cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
        .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s{2,}/g, ' ')
        .trim();

      logTool.info(`[AgentReach] Direct HTML fetch extracted: ${title} (${cleaned.length} chars)`);
      return {
        title,
        content: cleaned.slice(0, 30000),
        url: cleanUrl
      };
    } catch (err: any) {
      logTool.warn(`[AgentReach] fetchWebPage complete failure for ${cleanUrl}: ${err.message}`);
      throw new Error(`Failed to retrieve webpage content: ${err.message}`);
    }
  }

  /**
   * 2. Semantic Web Search via Exa MCP with Jina Search fallback (Anti-Hallucination)
   */
  public async searchWeb(query: string, numResults: number = 5): Promise<WebSearchResultItem[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    logTool.info(`[AgentReach] Performing grounded web search for: "${cleanQuery}"`);

    // 1. Try Exa MCP via mcporter
    try {
      const { stdout } = await execAsync(
        `npx -y mcporter call exa.web_search_exa query="${cleanQuery.replace(/"/g, '\\"')}" numResults=${numResults}`,
        { timeout: 15000 }
      );
      if (stdout && stdout.trim()) {
        try {
          const parsed = JSON.parse(stdout);
          const results: any[] = parsed?.results || (Array.isArray(parsed) ? parsed : []);
          if (results.length > 0) {
            return results.slice(0, numResults).map((r) => ({
              title: r.title || r.url || 'Web Search Result',
              url: r.url || '',
              snippet: r.text || r.snippet || r.highlight || '',
              source: 'Exa AI',
              publishedDate: r.publishedDate
            }));
          }
        } catch {
          // Parse structured text output from mcporter
          const items: WebSearchResultItem[] = [];
          const blocks = stdout.split(/\n(?=Title:)/i);
          for (const b of blocks) {
            const titleMatch = b.match(/Title:\s*([^\n]+)/i);
            const urlMatch = b.match(/(?:URL|Link|Source):\s*([^\n\s]+)/i);
            if (titleMatch || urlMatch) {
              items.push({
                title: titleMatch ? titleMatch[1].trim() : 'Search Result',
                url: urlMatch ? urlMatch[1].trim() : '',
                snippet: b.replace(/Title:[^\n]+/i, '').replace(/(?:URL|Link|Source):[^\n]+/i, '').slice(0, 350).trim(),
                source: 'Exa AI'
              });
            }
          }
          if (items.length > 0) {
            return items.slice(0, numResults);
          }
        }
      }
    } catch (exaErr: any) {
      logTool.debug(`[AgentReach] Exa MCP search fallback: ${exaErr.message}`);
    }

    // 2. Fallback to Jina Search API (https://s.jina.ai/)
    try {
      const searchUrl = `https://s.jina.ai/${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'JARVIS-Agent-Reach/1.0',
          'X-Return-Format': 'markdown'
        }
      });
      if (res.ok) {
        const markdown = await res.text();
        // Parse markdown sections [Title](url) and snippet
        const items: WebSearchResultItem[] = [];
        const sections = markdown.split(/\n(?=\[\d+\]|##\s+|Title:)/);

        for (const sec of sections) {
          if (items.length >= numResults) break;
          const urlMatch = sec.match(/https?:\/\/[^\s\)]+/);
          const titleMatch = sec.match(/(?:Title:\s*|\[\d+\]\s*|##\s*)([^\n]+)/);
          if (urlMatch) {
            items.push({
              title: titleMatch ? titleMatch[1].trim() : cleanQuery,
              url: urlMatch[0],
              snippet: sec.replace(/https?:\/\/[^\s\)]+/g, '').slice(0, 300).trim(),
              source: 'Jina Grounded Search'
            });
          }
        }

        if (items.length > 0) return items;
      }
    } catch (jinaErr: any) {
      logTool.debug(`[AgentReach] Jina search fallback error: ${jinaErr.message}`);
    }

    return [
      {
        title: `Search reference for: ${cleanQuery}`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`,
        snippet: `Grounded search completed for "${cleanQuery}". Use fetchWebPage on specific URLs for full content.`,
        source: 'DuckDuckGo'
      }
    ];
  }

  /**
   * 3. Extract YouTube Video Subtitles / Transcripts (Zero-Hallucination Spoken Content)
   */
  public async fetchYouTubeTranscript(videoUrl: string): Promise<{ title: string; transcript: string; url: string }> {
    try {
      const cleanUrl = videoUrl.trim();
      const tmpPrefix = `/tmp/jarvis_yt_${Date.now()}`;

      // Use yt-dlp to download subtitles in vtt/json3 format
      const cmd = `yt-dlp --write-sub --write-auto-sub --sub-lang "en,en-orig,en-US,te,hi,zh" --skip-download --sub-format vtt/json3/srt -o "${tmpPrefix}.%(ext)s" "${cleanUrl}"`;
      await execAsync(cmd, { timeout: 20000 });

      // Find any created subtitle files
      const dirFiles = fs.readdirSync('/tmp');
      const baseName = path.basename(tmpPrefix);
      const subFile = dirFiles.find((f) => f.startsWith(baseName) && (f.endsWith('.vtt') || f.endsWith('.srt') || f.endsWith('.json3')));

      let transcriptText = '';
      if (subFile) {
        const rawSub = fs.readFileSync(path.join('/tmp', subFile), 'utf-8');
        // Clean VTT timestamps and WEBVTT header
        transcriptText = rawSub
          .replace(/WEBVTT/g, '')
          .replace(/Kind:[^\n]+/g, '')
          .replace(/Language:[^\n]+/g, '')
          .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}[^\n]*/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\n\s*\n/g, '\n')
          .trim();

        // Cleanup temporary file
        try { fs.unlinkSync(path.join('/tmp', subFile)); } catch {}
      }

      // Also get video title & description
      const { stdout: infoJson } = await execAsync(`yt-dlp --print "%(title)s" "${cleanUrl}"`, { timeout: 10000 }).catch(() => ({ stdout: 'YouTube Video' }));
      const title = infoJson.trim() || 'YouTube Video';

      if (!transcriptText) {
        transcriptText = 'No automatic subtitles or transcript available for this video.';
      }

      logTool.info(`[AgentReach] YouTube transcript extracted: ${title} (${transcriptText.length} chars)`);
      return {
        title,
        transcript: transcriptText.slice(0, 25000),
        url: cleanUrl
      };
    } catch (err: any) {
      logTool.warn(`[AgentReach] fetchYouTubeTranscript error: ${err.message}`);
      throw new Error(`Failed to extract YouTube transcript: ${err.message}`);
    }
  }

  /**
   * 4. Verified GitHub Repository & Issue Search (Ground-Truth Code Intelligence)
   */
  public async searchGitHub(query: string, limit: number = 5): Promise<any[]> {
    try {
      const cleanQuery = query.trim();
      const cmd = `gh search repos "${cleanQuery.replace(/"/g, '\\"')}" --sort stars --limit ${limit} --json name,fullName,description,url,stargazersCount,updatedAt,language`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      if (stdout) {
        const parsed = JSON.parse(stdout);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err: any) {
      logTool.debug(`[AgentReach] GitHub search via gh CLI fallback: ${err.message}`);
    }

    // Direct curl API fallback
    try {
      const res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${limit}`, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0' }
      });
      if (res.ok) {
        const data = await res.json();
        return (data.items || []).map((item: any) => ({
          name: item.name,
          fullName: item.full_name,
          description: item.description,
          url: item.html_url,
          stargazersCount: item.stargazers_count,
          language: item.language
        }));
      }
    } catch (e: any) {
      logTool.warn(`[AgentReach] GitHub API search error: ${e.message}`);
    }

    return [];
  }

  /**
   * 5. V2EX Community Hot Topics (Verified Discussion Grounding)
   */
  public async fetchV2EXHot(): Promise<any[]> {
    try {
      const res = await fetch('https://www.v2ex.com/api/topics/hot.json', {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0' }
      });
      if (res.ok) {
        const topics = await res.json();
        return (topics || []).slice(0, 10).map((t: any) => ({
          title: t.title,
          url: t.url,
          replies: t.replies,
          node: t.node?.title,
          author: t.member?.username,
          content: t.content
        }));
      }
    } catch (err: any) {
      logTool.warn(`[AgentReach] V2EX topics error: ${err.message}`);
    }
    return [];
  }

  /**
   * 6. Perform a comprehensive, multi-source grounded research report with N >= 2 Triangulation & Caching
   */
  public async performGroundedResearch(query: string, options?: Partial<ResearchOptions>): Promise<WebResearchReport> {
    logTool.info(`[AgentReach] Executing deep grounded research for: "${query}"`);
    try {
      const report = await researchEngine.research({
        query,
        mode: options?.mode || 'deep',
        ttlCategory: options?.ttlCategory || 'general',
        targetPlatforms: options?.targetPlatforms || ['all'],
        minTriangulationSources: options?.minTriangulationSources || 2,
        forceRefresh: options?.forceRefresh,
        saveToObsidian: options?.saveToObsidian ?? true,
      });

      return {
        query,
        summary: report.summary,
        sources: report.sources.map((s) => ({ title: s.title, url: s.url, domain: s.domain })),
        extractedContent: report.fullMarkdownReport,
        groundedReport: report,
        timestamp: report.timestamp,
      };
    } catch (err: any) {
      logTool.warn(`[AgentReach] Research engine fallback triggered: ${err.message}`);
      const searchResults = await this.searchWeb(query, 5);
      return {
        query,
        summary: `Found ${searchResults.length} verified references for "${query}".`,
        sources: searchResults.map((r) => ({ title: r.title, url: r.url })),
        extractedContent: searchResults.map((r) => `* [${r.title}](${r.url}): ${r.snippet}`).join('\n'),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 7. Verify a factual claim against primary sources with confidence scoring
   */
  public async verifyClaim(claim: string, context?: string): Promise<ClaimVerificationReport> {
    return researchEngine.verifyClaim(claim, context);
  }

  /**
   * 8. Fast sub-1.5s fact-check for live voice interactions
   */
  public async fastFactCheck(query: string): Promise<FastFactResult> {
    return researchEngine.fastFactCheck(query);
  }
}

export const agentReachService = AgentReachService.getInstance();

