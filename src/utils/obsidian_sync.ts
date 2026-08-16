import fs from 'fs';
import path from 'path';
import { eventBus } from '../core/event_bus';
import { logObsidian } from '../core/logger';
import { obsidianDailyLogger } from './obsidian_logger';

export class ObsidianMemorySyncBridge {
  private static instance: ObsidianMemorySyncBridge;
  private vaultRoot: string;
  private knowledgeDir: string;

  public static getInstance(): ObsidianMemorySyncBridge {
    if (!ObsidianMemorySyncBridge.instance) {
      ObsidianMemorySyncBridge.instance = new ObsidianMemorySyncBridge();
    }
    return ObsidianMemorySyncBridge.instance;
  }

  constructor() {
    this.vaultRoot = path.join(process.cwd(), 'JARVIS-MEMORY');
    this.knowledgeDir = path.join(this.vaultRoot, 'memory', 'Knowledge Base');
    this.ensureDirs();
    this.bindEvents();
    logObsidian.info('Obsidian 2-Way Memory Sync Bridge active.');
  }

  private ensureDirs() {
    if (!fs.existsSync(this.knowledgeDir)) {
      fs.mkdirSync(this.knowledgeDir, { recursive: true });
    }
    const indexPath = path.join(this.vaultRoot, 'INDEX.md');
    const lowerIndexPath = path.join(this.vaultRoot, 'index.md');
    if (!fs.existsSync(indexPath)) {
      const indexContent = `# 🧠 JARVIS Universal Memory Vault\n\n- [[memory/Knowledge Base/|Knowledge Base]]\n- [[memory/Daily Logs/|Daily Logs]]\n`;
      fs.writeFileSync(indexPath, indexContent, 'utf-8');
    }
    if (!fs.existsSync(lowerIndexPath)) {
      try {
        fs.linkSync(indexPath, lowerIndexPath);
      } catch {
        fs.copyFileSync(indexPath, lowerIndexPath);
      }
    }
  }

  private bindEvents() {
    // 1. Sync memory fact to Obsidian
    eventBus.on('memory:fact_added', (fact) => {
      this.syncFactToMarkdown(fact);
      obsidianDailyLogger.logFactExtracted({
        category: fact.category,
        key: fact.key,
        value: fact.value,
        source: fact.source,
      });
    });

    // 2. Sync tool execution to daily log
    eventBus.on('tool:after_execute', (data) => {
      obsidianDailyLogger.logToolExecution({
        toolName: data.toolName,
        args: {},
        success: data.success,
        durationMs: data.durationMs,
        resultSummary: typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
      });
    });

    // 3. Sync completed tasks to daily objectives
    eventBus.on('task:completed', (data) => {
      obsidianDailyLogger.logDailyTask(`Task Completed: ${data.taskId}`, true);
    });
  }

  public syncFactToMarkdown(fact: { category: string; key: string; value: string; updated_at?: string }) {
    try {
      const filePath = path.join(this.knowledgeDir, 'User Profile & Preferences.md');
      let content = '';

      if (fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf8');
      } else {
        content = `---
title: User Profile & Preferences
tags:
  - jarvis
  - memory
  - user-profile
type: permanent-memory
status: active
---

# 👤 User Profile & Long-Term Context

> [!NOTE] Memory Synchronization
> Automatically synchronized in real-time from J.A.R.V.I.S. SQLite Memory Engine.

---

## 📌 Preferences & Work Context
`;
      }

      const factLine = `- **${fact.key}**: ${fact.value} *(Category: ${fact.category})*`;

      if (!content.includes(`**${fact.key}**:`)) {
        content += `\n${factLine}\n`;
      } else {
        const regex = new RegExp(`- \\*\\*${fact.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*:.*`, 'g');
        content = content.replace(regex, factLine);
      }

      fs.writeFileSync(filePath, content, 'utf8');
      logObsidian.info(`Synchronized memory fact '${fact.key}' to ${filePath}`);
      eventBus.emit('obsidian:synced', { file: filePath, type: 'fact_sync' });
    } catch (err: any) {
      logObsidian.error(`Failed to sync memory fact to Obsidian: ${err.message}`);
    }
  }

  public getVaultIndex(): {
    success: boolean;
    vaultRoot: string;
    indexPath: string;
    title: string;
    content: string;
    domains: Array<{ id: string; name: string; count: number; path: string }>;
    stats: { totalFiles: number; totalMemories: number; lastUpdated: string };
  } {
    this.ensureDirs();
    const indexPath = path.join(this.vaultRoot, 'INDEX.md');
    let content = '';
    if (fs.existsSync(indexPath)) {
      content = fs.readFileSync(indexPath, 'utf8');
    } else {
      content = '# 🧠 JARVIS Universal Memory Vault\n\nWelcome to your unified personal AI second brain.';
    }

    const domainFolders = [
      { id: 'facts', name: 'Facts & Identity', sub: 'facts' },
      { id: 'decisions', name: 'Decisions & Architecture', sub: 'decisions' },
      { id: 'lessons', name: 'Lessons Learned', sub: 'lessons' },
      { id: 'patterns', name: 'Patterns & Workflows', sub: 'patterns' },
      { id: 'knowledge', name: 'Knowledge Graph', sub: 'knowledge' },
      { id: 'conversations', name: 'Dialogue History', sub: 'conversations' },
      { id: 'daily', name: 'Daily Logs', sub: 'daily' },
    ];

    let totalFiles = 0;
    const domains = domainFolders.map((d) => {
      const dirPath = path.join(this.vaultRoot, d.sub);
      let count = 0;
      if (fs.existsSync(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'));
          count = files.length;
          totalFiles += count;
        } catch {}
      }
      return {
        id: d.id,
        name: d.name,
        count,
        path: `${d.sub}/`,
      };
    });

    let totalMemories = 0;
    try {
      const { memoryRepo } = require('../db/db');
      totalMemories = memoryRepo.getAll().length;
    } catch {}

    return {
      success: true,
      vaultRoot: this.vaultRoot,
      indexPath,
      title: 'JARVIS Universal Memory Vault',
      content,
      domains,
      stats: {
        totalFiles,
        totalMemories,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

export const obsidianSyncBridge = ObsidianMemorySyncBridge.getInstance();
