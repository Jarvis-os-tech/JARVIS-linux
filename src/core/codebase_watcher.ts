// J.A.R.V.I.S. Real-Time Codebase Change Watcher & Graph Syncer
// Monitors workspace directories and automatically triggers knowledge graph
// sync with debounce whenever source code or configuration changes.

import fs from 'fs';
import path from 'path';
import { codebaseMemory } from './codebase_memory';
import { logOrchestrator } from './logger';
import { eventBus } from './event_bus';

const WATCH_DIRS = ['src', 'core_engine', 'custom_tools'];
const WATCH_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.py', '.cpp', '.hpp', '.c', '.h', '.rs', '.sql', '.md'
]);

export class CodebaseWatcher {
  private static instance: CodebaseWatcher;
  private watchers: fs.FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public static getInstance(): CodebaseWatcher {
    if (!CodebaseWatcher.instance) {
      CodebaseWatcher.instance = new CodebaseWatcher();
    }
    return CodebaseWatcher.instance;
  }

  constructor() {}

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const rootDir = process.cwd();

    for (const subDir of WATCH_DIRS) {
      const fullPath = path.join(rootDir, subDir);
      if (!fs.existsSync(fullPath)) continue;

      try {
        const watcher = fs.watch(fullPath, { recursive: true }, (eventType, filename) => {
          if (!filename) return;

          const ext = path.extname(filename);
          if (WATCH_EXTENSIONS.has(ext)) {
            this.handleFileChange(eventType, path.join(subDir, filename));
          }
        });

        this.watchers.push(watcher);
      } catch (err: any) {
        logOrchestrator.warn(`[CodebaseWatcher] Could not attach watcher to ${subDir}: ${err.message}`);
      }
    }

    // Also watch root level files like server.ts, package.json
    try {
      const rootWatcher = fs.watch(rootDir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;
        const ext = path.extname(filename);
        if (WATCH_EXTENSIONS.has(ext) && !filename.startsWith('.')) {
          this.handleFileChange(eventType, filename);
        }
      });
      this.watchers.push(rootWatcher);
    } catch {}

    logOrchestrator.info(`👁️ [CodebaseWatcher] Real-time filesystem watcher active on [${WATCH_DIRS.join(', ')}].`);
  }

  private handleFileChange(eventType: string, relPath: string): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      logOrchestrator.info(`⚡ [CodebaseWatcher] Detected file change: ${relPath} (${eventType}). Triggering CBM sync...`);
      eventBus.emit('codebase:file_modified', { path: relPath, eventType });
      codebaseMemory.syncRepository().catch((err) => {
        logOrchestrator.warn(`[CodebaseWatcher] Knowledge graph auto-sync error: ${err.message}`);
      });
    }, 1200);
  }

  public stop(): void {
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {}
    }
    this.watchers = [];
    this.isRunning = false;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    logOrchestrator.info('🛑 [CodebaseWatcher] Real-time filesystem watcher stopped.');
  }
}

export const codebaseWatcher = CodebaseWatcher.getInstance();
