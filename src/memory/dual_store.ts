// Hermes-Grade Dual-Store Memory & Profile Engine for J.A.R.V.I.S.
// Manages MEMORY.md (working/system knowledge) and USER.md (user profile)
// with token bounds, prompt injection defense, and frozen system prompt snapshots.

import fs from 'fs';
import path from 'path';
import { memoryRepo, sessionRepo, MemoryRecord } from '../db/db';
import { eventBus } from '../core/event_bus';
import { securityGuard } from '../core/security_guard';
import { logMemory } from '../core/logger';

const MEMORY_DIR = path.join(process.cwd(), 'JARVIS-MEMORY');
const MEMORY_MD_PATH = path.join(MEMORY_DIR, 'MEMORY.md');
const USER_MD_PATH = path.join(MEMORY_DIR, 'USER.md');

// Also check Hermes profile if exists for instant sync
const HERMES_MEMORIES_DIR = '/home/gopi/.hermes/memories';

export const MEMORY_CHAR_LIMIT = 2200;
export const USER_CHAR_LIMIT = 1375;

export interface MemorySnapshot {
  memoryContent: string;
  userContent: string;
  combinedFormattedPrompt: string;
  timestamp: number;
}

export class DualStoreMemoryManager {
  private static instance: DualStoreMemoryManager;
  private cachedSnapshot: MemorySnapshot | null = null;

  public static getInstance(): DualStoreMemoryManager {
    if (!DualStoreMemoryManager.instance) {
      DualStoreMemoryManager.instance = new DualStoreMemoryManager();
    }
    return DualStoreMemoryManager.instance;
  }

  constructor() {
    this.ensureFilesExist();
    this.hydrateFromHermesIfAvailable();
  }

  private ensureFilesExist(): void {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }

    if (!fs.existsSync(MEMORY_MD_PATH)) {
      const initialMemory = `# J.A.R.V.I.S. Persistent Knowledge Base
- Operator: Gopi (BTech Engineer)
- AI Identity: JARVIS / FRIDAY autonomous agent fleet
- Local-First Architecture: Ubuntu Linux with native C++ workers and WebRTC/WebSocket audio
- Mission: 24/7 continuous autonomous agent operations, research, coding, and workflow automation
`;
      fs.writeFileSync(MEMORY_MD_PATH, initialMemory, 'utf-8');
    }

    if (!fs.existsSync(USER_MD_PATH)) {
      const initialUser = `# User Profile: Gopi
- Name: Gopi
- Style: Direct, technical depth welcome, concise and proactive
- Persona preference: Jarvis/Friday witty, conversational, speaks WITH user
- Primary focus: Full autonomous agent fleet, Linux systems, WebRTC live audio, multi-model AI
`;
      fs.writeFileSync(USER_MD_PATH, initialUser, 'utf-8');
    }
  }

  private hydrateFromHermesIfAvailable(): void {
    try {
      if (fs.existsSync(HERMES_MEMORIES_DIR)) {
        const hermesMem = path.join(HERMES_MEMORIES_DIR, 'MEMORY.md');
        const hermesUser = path.join(HERMES_MEMORIES_DIR, 'USER.md');

        if (fs.existsSync(hermesMem)) {
          const content = fs.readFileSync(hermesMem, 'utf-8').trim();
          if (content.length > 50 && (!fs.existsSync(MEMORY_MD_PATH) || fs.statSync(MEMORY_MD_PATH).size < 100)) {
            fs.writeFileSync(MEMORY_MD_PATH, content, 'utf-8');
            logMemory.info('Synchronized MEMORY.md from Hermes profile.');
          }
        }

        if (fs.existsSync(hermesUser)) {
          const content = fs.readFileSync(hermesUser, 'utf-8').trim();
          if (content.length > 50 && (!fs.existsSync(USER_MD_PATH) || fs.statSync(USER_MD_PATH).size < 100)) {
            fs.writeFileSync(USER_MD_PATH, content, 'utf-8');
            logMemory.info('Synchronized USER.md from Hermes profile.');
          }
        }
      }
    } catch (err: any) {
      logMemory.warn(`Hermes memory hydration skipped: ${err.message}`);
    }
  }

  /**
   * Load raw MEMORY.md content with character limit enforcement.
   */
  public getMemoryNotes(): string {
    try {
      if (!fs.existsSync(MEMORY_MD_PATH)) return '';
      let raw = fs.readFileSync(MEMORY_MD_PATH, 'utf-8');
      const scan = securityGuard.scanPromptInjection(raw);
      if (!scan.safe) {
        logMemory.warn(`Blocked potential injection in MEMORY.md: ${scan.reason}`);
        raw = raw.replace(/[<>{}[\]]/g, '');
      }
      return raw.slice(0, MEMORY_CHAR_LIMIT);
    } catch {
      return '';
    }
  }

  /**
   * Load raw USER.md profile with character limit enforcement.
   */
  public getUserProfile(): string {
    try {
      if (!fs.existsSync(USER_MD_PATH)) return '';
      let raw = fs.readFileSync(USER_MD_PATH, 'utf-8');
      const scan = securityGuard.scanPromptInjection(raw);
      if (!scan.safe) {
        logMemory.warn(`Blocked potential injection in USER.md: ${scan.reason}`);
        raw = raw.replace(/[<>{}[\]]/g, '');
      }
      return raw.slice(0, USER_CHAR_LIMIT);
    } catch {
      return '';
    }
  }

  /**
   * Build the Frozen Memory Snapshot for System Instructions.
   * Ensures system prompt byte stability across turns.
   */
  public getFrozenSnapshot(forceRefresh = false): MemorySnapshot {
    if (this.cachedSnapshot && !forceRefresh) {
      return this.cachedSnapshot;
    }

    const memoryContent = this.getMemoryNotes();
    const userContent = this.getUserProfile();

    // Also pull structured facts from SQLite memoryRepo
    const dbFacts = memoryRepo.getAll();
    const dbFactStr = dbFacts.length > 0
      ? dbFacts.slice(0, 15).map(f => `- [${f.category.toUpperCase()}] ${f.key}: ${f.value}`).join('\n')
      : '';

    const combinedFormattedPrompt = `
[PERSISTENT LONG-TERM MEMORY & USER PROFILE]
=== OPERATOR PROFILE (USER.md) ===
${userContent}

=== PERSISTENT KNOWLEDGE (MEMORY.md) ===
${memoryContent}
${dbFactStr ? `\n=== STRUCTURED FACTS (SQLite) ===\n${dbFactStr}` : ''}
`;

    this.cachedSnapshot = {
      memoryContent,
      userContent,
      combinedFormattedPrompt: combinedFormattedPrompt.trim(),
      timestamp: Date.now(),
    };

    return this.cachedSnapshot;
  }

  /**
   * Append or update persistent memory note.
   */
  public saveMemoryFact(key: string, value: string, category: 'preference' | 'personal_fact' | 'work_context' | 'topic' | 'custom' = 'custom'): void {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: MemoryRecord = {
      id,
      category,
      key,
      value,
      source: 'user_added',
      updated_at: new Date().toISOString(),
    };

    memoryRepo.upsert(record);

    // Also append to MEMORY.md
    try {
      const entry = `\n- § [${category.toUpperCase()}] ${key}: ${value}`;
      fs.appendFileSync(MEMORY_MD_PATH, entry, 'utf-8');
      logMemory.info(`Memory fact saved: "${key}"`);
      eventBus.emit('memory:created', { content: `${key}: ${value}`, importance: 1 });
    } catch (err: any) {
      logMemory.error(`Failed to append to MEMORY.md: ${err.message}`);
    }

    // Invalidate cached snapshot
    this.cachedSnapshot = null;
  }

  /**
   * Episodic session search across past conversations.
   */
  public searchEpisodicMemory(query: string, limit = 10): Array<{ session_id: string; content: string; role: string; created_at: number }> {
    return sessionRepo.searchPastConversations(query, limit);
  }

  /**
   * Log a conversation turn for episodic memory search.
   */
  public logTurn(sessionId: string, userMsg: string, assistantMsg: string, toolCalls?: any[], toolResults?: any[]): void {
    const now = Date.now();
    // Ensure parent session record exists
    const session = sessionRepo.getOrCreate(sessionId);

    sessionRepo.addMessage({
      id: `msg_u_${now}_${Math.random().toString(36).substring(2, 6)}`,
      session_id: session.id,
      role: 'user',
      content: userMsg,
      created_at: now,
    });

    sessionRepo.addMessage({
      id: `msg_a_${now + 1}_${Math.random().toString(36).substring(2, 6)}`,
      session_id: session.id,
      role: 'assistant',
      content: assistantMsg,
      tool_calls_json: toolCalls ? JSON.stringify(toolCalls) : undefined,
      tool_results_json: toolResults ? JSON.stringify(toolResults) : undefined,
      created_at: now + 1,
    });
  }
}

export const dualStoreMemory = DualStoreMemoryManager.getInstance();
