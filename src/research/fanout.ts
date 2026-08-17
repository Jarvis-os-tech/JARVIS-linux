import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { ScrapedDocument, ResearchMode, TargetPlatform } from './types';
import { contentExtractor } from './extractor';
import { logTool } from '../core/logger';

const execAsync = promisify(exec);

export interface CircuitState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

export class AsyncFanOutCoordinator {
  private static instance: AsyncFanOutCoordinator;
  private circuits: Map<string, CircuitState> = new Map();
  private readonly FAILURE_THRESHOLD = 3;
  private readonly COOLDOWN_MS = 60000; // 1 minute cooldown

  public static getInstance(): AsyncFanOutCoordinator {
    if (!AsyncFanOutCoordinator.instance) {
      AsyncFanOutCoordinator.instance = new AsyncFanOutCoordinator();
    }
    return AsyncFanOutCoordinator.instance;
  }

  constructor() {}

  /**
   * Check circuit breaker state before invoking a source adapter
   */
  private isCircuitAvailable(sourceName: string): boolean {
    const circuit = this.circuits.get(sourceName);
    if (!circuit) return true;

    if (circuit.state === 'OPEN') {
      if (Date.now() - circuit.lastFailureTime > this.COOLDOWN_MS) {
        circuit.state = 'HALF_OPEN';
        logTool.info(`[FanOut] Circuit for ${sourceName} transitioning to HALF_OPEN.`);
        return true;
      }
      logTool.debug(`[FanOut] Circuit OPEN for ${sourceName}. Skipping.`);
      return false;
    }
    return true;
  }

  private recordSuccess(sourceName: string) {
    const circuit = this.circuits.get(sourceName);
    if (circuit) {
      circuit.failures = 0;
      circuit.state = 'CLOSED';
    }
  }

  private recordFailure(sourceName: string, err: any) {
    let circuit = this.circuits.get(sourceName);
    if (!circuit) {
      circuit = { failures: 0, lastFailureTime: 0, state: 'CLOSED' };
      this.circuits.set(sourceName, circuit);
    }
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    if (circuit.failures >= this.FAILURE_THRESHOLD) {
      circuit.state = 'OPEN';
      logTool.warn(`[FanOut] Circuit OPEN for ${sourceName} after ${circuit.failures} consecutive failures: ${err?.message || err}`);
    }
  }

  /**
   * Execute fan-out across multiple platforms with timeout budgets
   */
  public async fanOutQuery(
    query: string,
    mode: ResearchMode = 'deep',
    platforms: TargetPlatform[] = ['all'],
    maxResults: number = 8,
    timeoutMs: number = 8000
  ): Promise<ScrapedDocument[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const isFast = mode === 'fast';
    const effectiveTimeout = isFast ? Math.min(timeoutMs, 2000) : timeoutMs;
    const startTime = Date.now();

    logTool.info(`[FanOut] Starting fan-out search: "${cleanQuery}" (Mode: ${mode}, Timeout: ${effectiveTimeout}ms)`);

    const tasks: Promise<ScrapedDocument[]>[] = [];

    // 1. Primary Semantic Search (Exa MCP / Jina Search)
    if (platforms.includes('all') || platforms.includes('web')) {
      tasks.push(this.searchExaAndJina(cleanQuery, maxResults, isFast ? 1500 : 4000));
    }

    // 2. GitHub Repositories & Docs
    if (platforms.includes('all') || platforms.includes('github')) {
      tasks.push(this.searchGitHub(cleanQuery, isFast ? 2 : 4, isFast ? 1500 : 3500));
    }

    // 3. Academic & Technical (ArXiv)
    if ((platforms.includes('all') || platforms.includes('arxiv')) && !isFast) {
      tasks.push(this.searchArXiv(cleanQuery, 3, 3500));
    }

    // 4. Community Discussions (V2EX / Reddit)
    if (platforms.includes('all') || platforms.includes('social') || platforms.includes('v2ex')) {
      tasks.push(this.searchV2EXAndCommunity(cleanQuery, isFast ? 2 : 4, isFast ? 1200 : 3000));
    }

    // Run parallel fan-out with timeout race
    let results: ScrapedDocument[] = [];
    try {
      const settled = await Promise.allSettled(
        tasks.map((p) =>
          Promise.race([
            p,
            new Promise<ScrapedDocument[]>((_, reject) =>
              setTimeout(() => reject(new Error(`Fan-out timeout after ${effectiveTimeout}ms`)), effectiveTimeout)
            ),
          ])
        )
      );

      for (const res of settled) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          results.push(...res.value);
        }
      }
    } catch (err: any) {
      logTool.warn(`[FanOut] Fanout race partial failure: ${err.message}`);
    }

    // Deduplicate by URL or title
    const uniqueDocs = this.deduplicateDocuments(results);
    logTool.info(`[FanOut] Fanout collected ${uniqueDocs.length} unique sources in ${Date.now() - startTime}ms`);

    // In deep mode, fetch full web page content for top 2-3 URLs that don't already have deep text
    if (!isFast && uniqueDocs.length > 0) {
      await this.enrichTopDocuments(uniqueDocs.slice(0, 3), 4000);
    }

    return uniqueDocs;
  }

  /**
   * 1. Exa MCP & Jina Grounded Search Adapter
   */
  public async searchExaAndJina(query: string, limit: number = 5, timeoutMs: number = 4000): Promise<ScrapedDocument[]> {
    const docs: ScrapedDocument[] = [];
    const start = Date.now();

    // 1. Try Exa via mcporter
    if (this.isCircuitAvailable('exa')) {
      try {
        const { stdout } = await execAsync(
          `npx -y mcporter call exa.web_search_exa query="${query.replace(/"/g, '\\"')}" numResults=${limit}`,
          { timeout: timeoutMs }
        );

        if (stdout && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout);
            const items: any[] = parsed?.results || (Array.isArray(parsed) ? parsed : []);
            for (const r of items) {
              if (r.url) {
                docs.push({
                  id: `exa-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  url: r.url,
                  domain: this.extractDomain(r.url),
                  title: r.title || 'Web Search Result',
                  content: r.text || r.snippet || r.highlight || '',
                  snippet: (r.snippet || r.text || '').slice(0, 300),
                  sourceName: 'Exa AI',
                  publishedDate: r.publishedDate,
                  fetchDurationMs: Date.now() - start,
                  success: true,
                });
              }
            }
            if (docs.length > 0) {
              this.recordSuccess('exa');
              return docs.slice(0, limit);
            }
          } catch {
            // Text parse fallback
          }
        }
      } catch (err: any) {
        this.recordFailure('exa', err);
      }
    }

    // 2. Fallback to Jina Search API (https://s.jina.ai/)
    if (this.isCircuitAvailable('jina_search')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
          headers: {
            'User-Agent': 'JARVIS-Agent-Reach/1.0',
            'X-Return-Format': 'markdown',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const markdown = await res.text();
          const sections = markdown.split(/\n(?=\[\d+\]|##\s+|Title:)/);

          for (const sec of sections) {
            if (docs.length >= limit) break;
            const urlMatch = sec.match(/https?:\/\/[^\s\)]+/);
            const titleMatch = sec.match(/(?:Title:\s*|\[\d+\]\s*|##\s*)([^\n]+)/);

            if (urlMatch) {
              const url = urlMatch[0];
              const title = titleMatch ? titleMatch[1].trim() : query;
              const content = contentExtractor.cleanText(sec);
              docs.push({
                id: `jina-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                url,
                domain: this.extractDomain(url),
                title,
                content,
                snippet: content.slice(0, 300),
                sourceName: 'Jina Search',
                fetchDurationMs: Date.now() - start,
                success: true,
              });
            }
          }

          if (docs.length > 0) {
            this.recordSuccess('jina_search');
            return docs;
          }
        }
      } catch (err: any) {
        this.recordFailure('jina_search', err);
      }
    }

    // 3. DuckDuckGo HTML Fallback
    try {
      const ddgDocs = await this.searchDuckDuckGo(query, limit, timeoutMs);
      if (ddgDocs.length > 0) return ddgDocs;
    } catch {}

    return docs;
  }

  /**
   * 2. GitHub Repositories & Readme Adapter
   */
  public async searchGitHub(query: string, limit: number = 4, timeoutMs: number = 3500): Promise<ScrapedDocument[]> {
    const docs: ScrapedDocument[] = [];
    const start = Date.now();

    // Try `gh` CLI first
    try {
      const cmd = `gh search repos "${query.replace(/"/g, '\\"')}" --sort stars --limit ${limit} --json name,fullName,description,url,stargazersCount,updatedAt,language`;
      const { stdout } = await execAsync(cmd, { timeout: timeoutMs });
      if (stdout) {
        const items = JSON.parse(stdout);
        if (Array.isArray(items)) {
          for (const item of items) {
            docs.push({
              id: `gh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              url: item.url || `https://github.com/${item.fullName}`,
              domain: 'github.com',
              title: `${item.fullName} (GitHub Repo - ⭐ ${item.stargazersCount || 0})`,
              content: `Repository: ${item.fullName}\nDescription: ${item.description || 'No description'}\nLanguage: ${item.language || 'N/A'}\nStars: ${item.stargazersCount || 0}\nUpdated: ${item.updatedAt || 'Recent'}`,
              snippet: item.description || `GitHub repository ${item.fullName}`,
              sourceName: 'GitHub',
              fetchDurationMs: Date.now() - start,
              success: true,
            });
          }
          if (docs.length > 0) return docs;
        }
      }
    } catch {}

    // Fallback to GitHub REST API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=${limit}`,
        {
          headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        for (const item of data.items || []) {
          docs.push({
            id: `gh-api-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: item.html_url,
            domain: 'github.com',
            title: `${item.full_name} (⭐ ${item.stargazers_count})`,
            content: `Repository: ${item.full_name}\nDescription: ${item.description || ''}\nPrimary Language: ${item.language || ''}\nStars: ${item.stargazers_count}`,
            snippet: item.description || item.full_name,
            sourceName: 'GitHub API',
            fetchDurationMs: Date.now() - start,
            success: true,
          });
        }
      }
    } catch {}

    return docs;
  }

  /**
   * 3. ArXiv Research Papers Adapter
   */
  public async searchArXiv(query: string, limit: number = 3, timeoutMs: number = 3500): Promise<ScrapedDocument[]> {
    const docs: ScrapedDocument[] = [];
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const xml = await res.text();
        const entries = xml.split('<entry>');

        for (let i = 1; i < entries.length; i++) {
          const entry = entries[i];
          const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
          const summaryMatch = entry.match(/<summary>([^<]+)<\/summary>/);
          const idMatch = entry.match(/<id>([^<]+)<\/id>/);
          const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);

          if (titleMatch && idMatch) {
            const title = titleMatch[1].replace(/\n/g, ' ').trim();
            const paperUrl = idMatch[1].trim();
            const summary = (summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').trim() : '');

            docs.push({
              id: `arxiv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              url: paperUrl,
              domain: 'arxiv.org',
              title: `${title} (ArXiv Paper)`,
              content: `Paper: ${title}\nAbstract: ${summary}\nPublished: ${publishedMatch ? publishedMatch[1] : ''}`,
              snippet: summary.slice(0, 300),
              sourceName: 'ArXiv',
              publishedDate: publishedMatch ? publishedMatch[1] : undefined,
              fetchDurationMs: Date.now() - start,
              success: true,
            });
          }
        }
      }
    } catch (err: any) {
      logTool.debug(`[FanOut] ArXiv fetch fallback: ${err.message}`);
    }

    return docs;
  }

  /**
   * 4. V2EX & Community Discussions Adapter
   */
  public async searchV2EXAndCommunity(query: string, limit: number = 3, timeoutMs: number = 2500): Promise<ScrapedDocument[]> {
    const docs: ScrapedDocument[] = [];
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch('https://www.v2ex.com/api/topics/hot.json', {
        headers: { 'User-Agent': 'JARVIS-Agent-Reach/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const topics = await res.json();
        const qTokens = contentExtractor.tokenize(query, true);

        for (const t of topics || []) {
          if (docs.length >= limit) break;
          const fullText = `${t.title} ${t.content || ''}`.toLowerCase();
          const matches = qTokens.some((tok) => fullText.includes(tok));

          if (matches || qTokens.length === 0) {
            docs.push({
              id: `v2ex-${t.id || Date.now()}`,
              url: t.url || `https://www.v2ex.com/t/${t.id}`,
              domain: 'v2ex.com',
              title: `${t.title} (V2EX Community)`,
              content: `Topic: ${t.title}\nAuthor: ${t.member?.username || 'Community'}\nContent: ${t.content || ''}`,
              snippet: (t.content || t.title).slice(0, 300),
              sourceName: 'V2EX',
              author: t.member?.username,
              fetchDurationMs: Date.now() - start,
              success: true,
            });
          }
        }
      }
    } catch {}

    return docs;
  }

  /**
   * 5. DuckDuckGo HTML Scraper Fallback
   */
  private async searchDuckDuckGo(query: string, limit: number = 5, timeoutMs: number = 3000): Promise<ScrapedDocument[]> {
    const docs: ScrapedDocument[] = [];
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const regex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = regex.exec(html)) !== null && docs.length < limit) {
          const rawUrl = match[1];
          const snippet = contentExtractor.cleanText(match[3]);
          const domain = this.extractDomain(rawUrl);

          docs.push({
            id: `ddg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: rawUrl,
            domain,
            title: `Search result: ${domain}`,
            content: snippet,
            snippet: snippet.slice(0, 300),
            sourceName: 'DuckDuckGo',
            fetchDurationMs: Date.now() - start,
            success: true,
          });
        }
      }
    } catch {}

    return docs;
  }

  /**
   * Enrich top documents with complete webpage text via Jina Reader
   */
  private async enrichTopDocuments(docs: ScrapedDocument[], timeoutMs: number = 4000): Promise<void> {
    await Promise.allSettled(
      docs.map(async (doc) => {
        if (!doc.url || !doc.url.startsWith('http') || doc.content.length > 2000) return;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          const res = await fetch(`https://r.jina.ai/${doc.url}`, {
            headers: {
              'User-Agent': 'JARVIS-Agent-Reach/1.0',
              'X-Return-Format': 'markdown',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (res.ok) {
            const fullMarkdown = await res.text();
            const cleaned = contentExtractor.cleanText(fullMarkdown);
            if (cleaned.length > doc.content.length) {
              doc.content = cleaned.slice(0, 25000);
              logTool.debug(`[FanOut] Enriched document ${doc.url} (${doc.content.length} chars)`);
            }
          }
        } catch {}
      })
    );
  }

  /**
   * Helper to deduplicate scraped documents by canonical URL or domain
   */
  private deduplicateDocuments(docs: ScrapedDocument[]): ScrapedDocument[] {
    const seen = new Set<string>();
    const unique: ScrapedDocument[] = [];

    for (const d of docs) {
      const key = (d.url || d.title).toLowerCase().replace(/\/$/, '');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(d);
      }
    }

    return unique;
  }

  private extractDomain(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return 'web';
    }
  }
}

export const fanOutCoordinator = AsyncFanOutCoordinator.getInstance();
