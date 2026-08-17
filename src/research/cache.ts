import crypto from 'crypto';
import { jarvisDb } from '../db/db';
import { logTool } from '../core/logger';
import { GroundedResearchReport, ResearchMode, TTLCategory } from './types';

// Tiered TTL in seconds
export const TTL_SECONDS: Record<TTLCategory, number> = {
  news: 30 * 60, // 30 minutes for fast-moving news / live events
  repos: 24 * 60 * 60, // 24 hours for github repos / packages
  packages: 24 * 60 * 60, // 24 hours for release versions / npm / pip
  docs: 7 * 24 * 60 * 60, // 7 days for static docs & manuals
  rfc: 7 * 24 * 60 * 60, // 7 days for RFCs & specs
  academic: 7 * 24 * 60 * 60, // 7 days for ArXiv / papers
  general: 12 * 60 * 60, // 12 hours for general web searches
  fact_check: 12 * 60 * 60, // 12 hours for verified claim fact checks
};

export class ResearchCache {
  private static instance: ResearchCache;

  public static getInstance(): ResearchCache {
    if (!ResearchCache.instance) {
      ResearchCache.instance = new ResearchCache();
    }
    return ResearchCache.instance;
  }

  constructor() {
    this.purgeExpired();
  }

  /**
   * Deterministically hash normalized query and parameters
   */
  public generateHash(query: string, mode: ResearchMode = 'deep', category: TTLCategory = 'general'): string {
    const normalized = `${query.trim().toLowerCase()}|mode:${mode}|cat:${category}`;
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Fetch cached research report if within valid TTL
   */
  public get(query: string, mode: ResearchMode = 'deep', category: TTLCategory = 'general'): GroundedResearchReport | null {
    try {
      const hash = this.generateHash(query, mode, category);
      const now = Date.now();

      const stmt = jarvisDb.db.prepare(`
        SELECT result_json, expires_at 
        FROM research_cache 
        WHERE hash = ?
      `);

      const row = stmt.get(hash) as { result_json: string; expires_at: number } | undefined;

      if (!row) {
        return null;
      }

      if (row.expires_at <= now) {
        // Expired entry
        this.deleteByHash(hash);
        logTool.debug(`[ResearchCache] Expired entry purged for: "${query}"`);
        return null;
      }

      const report: GroundedResearchReport = JSON.parse(row.result_json);
      report.cached = true;
      logTool.info(`[ResearchCache] Cache HIT for: "${query}" (expires in ${Math.round((row.expires_at - now) / 1000)}s)`);
      return report;
    } catch (err: any) {
      logTool.warn(`[ResearchCache] Error reading cache for "${query}": ${err.message}`);
      return null;
    }
  }

  /**
   * Store research report into SQLite WAL cache with appropriate TTL
   */
  public set(
    query: string,
    mode: ResearchMode = 'deep',
    category: TTLCategory = 'general',
    report: GroundedResearchReport,
    customTtlSeconds?: number
  ): void {
    try {
      const hash = this.generateHash(query, mode, category);
      const now = Date.now();
      const ttlSec = customTtlSeconds || TTL_SECONDS[category] || TTL_SECONDS.general;
      const expiresAt = now + ttlSec * 1000;

      const sourcesJson = JSON.stringify(report.sources || []);
      const triangulationJson = JSON.stringify(report.facts || []);
      const resultJson = JSON.stringify({ ...report, cached: false });

      const stmt = jarvisDb.db.prepare(`
        INSERT OR REPLACE INTO research_cache 
        (hash, query, mode, category, result_json, sources_json, triangulation_json, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(hash, query.trim(), mode, category, resultJson, sourcesJson, triangulationJson, now, expiresAt);
      logTool.info(`[ResearchCache] Cached result for: "${query}" (TTL: ${ttlSec}s, hash: ${hash.slice(0, 8)})`);
    } catch (err: any) {
      logTool.warn(`[ResearchCache] Error writing cache for "${query}": ${err.message}`);
    }
  }

  /**
   * Delete specific cache entry by hash
   */
  public deleteByHash(hash: string): boolean {
    const stmt = jarvisDb.db.prepare('DELETE FROM research_cache WHERE hash = ?');
    return stmt.run(hash).changes > 0;
  }

  /**
   * Delete specific cache entry by query and mode
   */
  public delete(query: string, mode: ResearchMode = 'deep', category: TTLCategory = 'general'): boolean {
    const hash = this.generateHash(query, mode, category);
    return this.deleteByHash(hash);
  }

  /**
   * Purge all expired cache entries
   */
  public purgeExpired(): number {
    try {
      const now = Date.now();
      const stmt = jarvisDb.db.prepare('DELETE FROM research_cache WHERE expires_at <= ?');
      const res = stmt.run(now);
      if (res.changes > 0) {
        logTool.info(`[ResearchCache] Purged ${res.changes} expired research cache entries.`);
      }
      return res.changes;
    } catch (err: any) {
      logTool.warn(`[ResearchCache] Error purging expired entries: ${err.message}`);
      return 0;
    }
  }

  /**
   * Clear entire research cache table
   */
  public clear(): void {
    jarvisDb.db.exec('DELETE FROM research_cache');
    logTool.info('[ResearchCache] Cleared all research cache entries.');
  }

  /**
   * Cache statistics
   */
  public getStats(): { totalEntries: number; validEntries: number; expiredEntries: number } {
    try {
      const now = Date.now();
      const totalStmt = jarvisDb.db.prepare('SELECT COUNT(*) as count FROM research_cache');
      const validStmt = jarvisDb.db.prepare('SELECT COUNT(*) as count FROM research_cache WHERE expires_at > ?');

      const total = (totalStmt.get() as any)?.count || 0;
      const valid = (validStmt.get(now) as any)?.count || 0;

      return {
        totalEntries: total,
        validEntries: valid,
        expiredEntries: total - valid,
      };
    } catch {
      return { totalEntries: 0, validEntries: 0, expiredEntries: 0 };
    }
  }
}

export const researchCache = ResearchCache.getInstance();
