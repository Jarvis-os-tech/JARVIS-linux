import fs from 'fs';
import path from 'path';
import { memoryClient } from './client';
import { memoryContextBuilder } from './context_builder';
import { logOrchestrator } from '../core/logger';

export interface WatcherEvent {
  eventType: 'create' | 'modify' | 'remove';
  filePath: string;
  relativePath: string;
  mtime: number;
}

export class VaultWatcher {
  private static instance: VaultWatcher;
  private vaultPath: string;
  private isWatching: boolean = false;
  private fileTimestamps: Map<string, number> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_MS = 600;

  public static getInstance(): VaultWatcher {
    if (!VaultWatcher.instance) {
      VaultWatcher.instance = new VaultWatcher();
    }
    return VaultWatcher.instance;
  }

  constructor(vaultPath: string = path.join(process.cwd(), 'JARVIS-MEMORY')) {
    this.vaultPath = vaultPath;
  }

  /**
   * Start watching the Obsidian vault directories
   */
  public start(): void {
    if (this.isWatching) return;
    if (!fs.existsSync(this.vaultPath)) {
      fs.mkdirSync(this.vaultPath, { recursive: true });
    }

    // Ensure 5 canonical directories exist
    const subdirs = ['knowledge', 'facts', 'context', 'conversations', 'execution'];
    for (const sub of subdirs) {
      const fullSub = path.join(this.vaultPath, sub);
      if (!fs.existsSync(fullSub)) {
        fs.mkdirSync(fullSub, { recursive: true });
      }
    }

    try {
      fs.watch(this.vaultPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.md') && !filename.endsWith('.txt')) return;
        if (filename.includes('.git') || filename.includes('node_modules')) return;

        this.handleRawFsEvent(filename);
      });

      this.isWatching = true;
      logOrchestrator.info(`[VaultWatcher] 👁️ Inotify file watcher active on ${this.vaultPath}`);
    } catch (err: any) {
      logOrchestrator.warn(`[VaultWatcher] Could not start fs.watch: ${err.message}`);
    }
  }

  private handleRawFsEvent(relPath: string): void {
    // Debounce rapid writes
    const existing = this.debounceTimers.get(relPath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(relPath);
      this.processFileChange(relPath).catch((err) => {
        logOrchestrator.warn(`[VaultWatcher] Error processing ${relPath}: ${err.message}`);
      });
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(relPath, timer);
  }

  private async processFileChange(relPath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, relPath);

    if (!fs.existsSync(fullPath)) {
      // File removed
      this.fileTimestamps.delete(relPath);
      logOrchestrator.info(`[VaultWatcher] Detected removed file: ${relPath}`);
      return;
    }

    const stats = fs.statSync(fullPath);
    const mtimeSecs = Math.floor(stats.mtimeMs / 1000);
    const lastSeen = this.fileTimestamps.get(relPath);

    if (lastSeen === mtimeSecs) {
      // Unchanged mtime, skip duplicate trigger
      return;
    }

    this.fileTimestamps.set(relPath, mtimeSecs);

    const rawContent = fs.readFileSync(fullPath, 'utf-8');
    if (!rawContent || rawContent.trim().length === 0) return;

    // Parse Frontmatter & Extract Metadata
    const title = this.extractTitle(rawContent, relPath);
    const kind = this.inferKind(relPath, rawContent);
    const tags = this.extractTags(rawContent, relPath);
    const links = this.extractWikilinks(rawContent);
    const sourceId = `vault_watcher:${relPath}@${mtimeSecs}`;

    logOrchestrator.info(`[VaultWatcher] Ingesting modified note: ${relPath} (source: ${sourceId})`);

    // Ingest into Universal Memory Engine
    await memoryClient.createNode({
      id: `doc-${Buffer.from(relPath).toString('hex').slice(0, 16)}`,
      title,
      content: rawContent,
      kind,
      tier: relPath.startsWith('facts/') || relPath.startsWith('knowledge/') ? 'persistent' : 'working',
      importance: 0.85,
      tags,
      links,
      scope: 'global',
    });

    memoryContextBuilder.invalidateCache();
  }

  private extractTitle(content: string, relPath: string): string {
    const titleMatch = content.match(/^#\s+([^\n]+)/m) || content.match(/title:\s*["']?([^\n"']+)["']?/i);
    if (titleMatch) return titleMatch[1].trim();
    return path.basename(relPath, path.extname(relPath));
  }

  private inferKind(relPath: string, content: string): 'fact' | 'decision' | 'preference' | 'pattern' | 'system' {
    if (relPath.includes('facts/')) return 'fact';
    if (relPath.includes('knowledge/')) return 'system';
    if (relPath.includes('execution/')) return 'decision';
    if (content.toLowerCase().includes('decision:') || content.toLowerCase().includes('architectural rule')) return 'decision';
    if (content.toLowerCase().includes('preference:') || content.toLowerCase().includes('user prefers')) return 'preference';
    return 'fact';
  }

  private extractTags(content: string, relPath: string): string[] {
    const tags = new Set<string>();
    // Subdir tag
    const folder = relPath.split(path.sep)[0];
    if (folder) tags.add(folder);

    // Frontmatter tags
    const fmTagsMatch = content.match(/tags:\s*\[([^\]]+)\]/i);
    if (fmTagsMatch) {
      fmTagsMatch[1].split(',').forEach((t) => tags.add(t.trim().replace(/^#/, '')));
    }

    // Inline #hashtags
    const hashMatches = content.match(/#[a-zA-Z0-9_-]+/g);
    if (hashMatches) {
      hashMatches.forEach((h) => tags.add(h.slice(1)));
    }

    return Array.from(tags).filter(Boolean);
  }

  private extractWikilinks(content: string): string[] {
    const links: string[] = [];
    const matches = content.matchAll(/\[\[(.*?)\]\]/g);
    for (const m of matches) {
      if (m[1]) {
        const linkTarget = m[1].split('|')[0].trim();
        links.push(linkTarget);
      }
    }
    return links;
  }
}

export const vaultWatcher = VaultWatcher.getInstance();
