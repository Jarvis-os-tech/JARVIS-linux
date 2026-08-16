import fs from 'fs';
import path from 'path';

export interface ConversationTurnLog {
  speaker: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  mode?: string;
  toolsUsed?: string[];
  personaId?: string;
  timestamp?: Date;
}

export interface ToolExecutionLog {
  toolName: string;
  args: Record<string, any>;
  success: boolean;
  resultSummary?: string;
  durationMs?: number;
  id?: string;
  timestamp?: Date;
}

export interface AgentDelegationLog {
  sourceManagerId: string;
  sourceManagerName: string;
  task: string;
  relayedSummary: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp?: Date;
}

export interface FactExtractedLog {
  category: string;
  key: string;
  value: string;
  source?: string;
  timestamp?: Date;
}

export class ObsidianDailyLogger {
  private vaultRoot: string;
  private conversationsDir: string;
  private executionDir: string;
  private factsDir: string;
  private knowledgeDir: string;
  private summariesDir: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(vaultPath?: string) {
    this.vaultRoot = vaultPath || path.join(process.cwd(), 'JARVIS-MEMORY');
    this.conversationsDir = path.join(this.vaultRoot, 'conversations');
    this.executionDir = path.join(this.vaultRoot, 'execution');
    this.factsDir = path.join(this.vaultRoot, 'facts');
    this.knowledgeDir = path.join(this.vaultRoot, 'knowledge');
    this.summariesDir = path.join(this.vaultRoot, 'summaries');
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    try {
      const dirs = [
        this.conversationsDir,
        this.executionDir,
        this.factsDir,
        this.knowledgeDir,
        this.summariesDir,
      ];
      for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (err) {
      console.error('[ObsidianLogger] Failed to create directories:', err);
    }
  }

  /**
   * Returns current local ISO date string: YYYY-MM-DD
   */
  private getLocalDateString(d: Date = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns formatted time: HH:MM:SS
   */
  private getLocalTimeString(d: Date = new Date()): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  /**
   * Ensures today's conversation file exists in conversations/YYYY-MM-DD.md
   */
  public ensureConversationFileExists(): string {
    this.ensureDirectoriesExist();
    const dateStr = this.getLocalDateString();
    const filePath = path.join(this.conversationsDir, `${dateStr}.md`);

    if (!fs.existsSync(filePath)) {
      const template = `---
title: Conversation Log - ${dateStr}
date: ${dateStr}
tags:
  - jarvis
  - conversation
  - dialogue
type: conversation-log
status: active
---

# 💬 Dialogue History — ${dateStr}

> [!NOTE] Synchronized Conversation Stream
> Multi-agent dialogue log tagged by speaker ([User], [JARVIS], [Hermes], [Ultron], etc.).

---

`;
      try {
        fs.writeFileSync(filePath, template, 'utf8');
      } catch (err) {
        console.error('[ObsidianLogger] Error creating conversation file:', err);
      }
    }

    return filePath;
  }

  /**
   * Ensures today's execution file exists in execution/YYYY-MM-DD.md
   */
  public ensureExecutionFileExists(): string {
    this.ensureDirectoriesExist();
    const dateStr = this.getLocalDateString();
    const filePath = path.join(this.executionDir, `${dateStr}.md`);

    if (!fs.existsSync(filePath)) {
      const template = `---
title: Tool Execution Log - ${dateStr}
date: ${dateStr}
tags:
  - jarvis
  - execution
  - tools
type: execution-log
status: active
---

# 🛠️ Tool & System Execution Log — ${dateStr}

> [!NOTE] Execution Telemetry
> Live tool calls, parameter arguments, duration, and success/failure outcomes.

---

`;
      try {
        fs.writeFileSync(filePath, template, 'utf8');
      } catch (err) {
        console.error('[ObsidianLogger] Error creating execution file:', err);
      }
    }

    return filePath;
  }

  /**
   * Backward-compatible alias for existing callers
   */
  public ensureDailyFileExists(): string {
    return this.ensureConversationFileExists();
  }

  /**
   * Queues an atomic append operation to preserve write order.
   */
  private queueAppend(operation: () => Promise<void> | void): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await operation();
      })
      .catch((err) => {
        console.error('[ObsidianLogger] Write queue error:', err);
      });
    return this.writeQueue;
  }

  /**
   * Logs a conversation turn tagged by speaker ([User], [JARVIS], [Hermes], [Ultron], etc.).
   */
  public logConversationTurn(entry: ConversationTurnLog): Promise<void> {
    return this.queueAppend(async () => {
      const filePath = this.ensureConversationFileExists();
      const time = this.getLocalTimeString(entry.timestamp || new Date());
      const isUser = entry.role === 'user';
      
      const agentTag = isUser
        ? `[User]`
        : `[${(entry.speaker || entry.personaId || 'JARVIS').toUpperCase()}]`;

      const speakerLabel = isUser
        ? `👤 **${agentTag}**`
        : `🤖 **${agentTag}**${entry.personaId && entry.personaId.toLowerCase() !== entry.speaker.toLowerCase() ? ` *(${entry.personaId})*` : ''}`;

      let turnBlock = `* **\`[${time}]\`** ${speakerLabel}:\n`;
      const indented = entry.text
        .split('\n')
        .map(line => `  > ${line}`)
        .join('\n');
      turnBlock += `${indented}\n\n`;

      try {
        fs.appendFileSync(filePath, turnBlock, 'utf8');
      } catch (err) {
        console.error(`[ObsidianLogger] Failed to log conversation turn:`, err);
      }
    });
  }

  /**
   * Logs a tool execution event to execution/YYYY-MM-DD.md
   */
  public logToolExecution(entry: ToolExecutionLog): Promise<void> {
    return this.queueAppend(async () => {
      const filePath = this.ensureExecutionFileExists();
      const time = this.getLocalTimeString(entry.timestamp || new Date());
      const statusIcon = entry.success ? '✅ Success' : '❌ Failed';
      const duration = entry.durationMs ? ` (${entry.durationMs}ms)` : '';

      let argsPreview = '';
      try {
        argsPreview = JSON.stringify(entry.args, null, 2);
      } catch {
        argsPreview = String(entry.args);
      }

      let toolBlock = `### \`[${time}]\` ${entry.toolName} — ${statusIcon}${duration}\n\n`;
      toolBlock += `* **Status**: \`${entry.success ? 'SUCCESS' : 'FAILED'}\`\n`;
      toolBlock += `* **Parameters**:\n\`\`\`json\n${argsPreview}\n\`\`\`\n`;
      if (entry.resultSummary) {
        toolBlock += `* **Output / Summary**:\n\`\`\`\n${entry.resultSummary.length > 500 ? entry.resultSummary.slice(0, 497) + '...' : entry.resultSummary}\n\`\`\`\n\n`;
      } else {
        toolBlock += `\n`;
      }

      try {
        fs.appendFileSync(filePath, toolBlock, 'utf8');
      } catch (err) {
        console.error(`[ObsidianLogger] Failed to log tool execution:`, err);
      }
    });
  }

  /**
   * Logs an agent delegation event.
   */
  public logAgentDelegation(entry: AgentDelegationLog): Promise<void> {
    return this.queueAppend(async () => {
      const filePath = this.ensureConversationFileExists();
      const time = this.getLocalTimeString(entry.timestamp || new Date());
      const badge = entry.severity === 'critical' ? '🔴 DANGER' : entry.severity === 'warning' ? '🟡 WARNING' : '🔵 INFO';

      const delegationBlock = `> [!important] **\`[${time}]\` [${badge}] Multi-Agent Delegation [${entry.sourceManagerName.toUpperCase()}]**\n> * **Task**: \`${entry.task}\`\n> * **Briefing**: ${entry.relayedSummary}\n\n`;

      try {
        fs.appendFileSync(filePath, delegationBlock, 'utf8');
      } catch (err) {
        console.error(`[ObsidianLogger] Failed to log delegation:`, err);
      }
    });
  }

  /**
   * Logs an extracted user fact or preference into facts/.
   */
  public logFactExtracted(entry: FactExtractedLog): Promise<void> {
    return this.queueAppend(async () => {
      this.ensureDirectoriesExist();
      const filePath = path.join(this.factsDir, 'User Profile & Preferences.md');
      const time = this.getLocalTimeString(entry.timestamp || new Date());
      const dateStr = this.getLocalDateString();
      const factLine = `- **${entry.key}**: ${entry.value} *(Category: ${entry.category}, Recorded: ${dateStr} ${time})*`;

      try {
        let content = '';
        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf8');
        } else {
          content = `---
title: User Profile & Preferences
tags:
  - jarvis
  - memory
  - facts
  - user-profile
type: facts-profile
status: active
---

# 👤 User Profile, Facts & Preferences

> [!NOTE] Facts Repository
> Auto-synchronized memory facts, identity vectors, and system preferences.

---

## 📌 Extracted Facts & Preferences
`;
        }

        if (!content.includes(`**${entry.key}**:`)) {
          content += `\n${factLine}\n`;
        } else {
          const regex = new RegExp(`- \\*\\*${entry.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*:.*`, 'g');
          content = content.replace(regex, factLine);
        }

        fs.writeFileSync(filePath, content, 'utf8');
      } catch (err) {
        console.error(`[ObsidianLogger] Failed to log fact:`, err);
      }
    });
  }

  /**
   * Appends or updates a daily objective / checklist item in conversation log.
   */
  public logDailyTask(taskName: string, completed: boolean = false): Promise<void> {
    return this.queueAppend(async () => {
      const filePath = this.ensureConversationFileExists();
      const box = completed ? '[x]' : '[ ]';
      const taskLine = `* ${box} **Task**: ${taskName}\n`;
      try {
        fs.appendFileSync(filePath, taskLine, 'utf8');
      } catch (err) {
        console.error(`[ObsidianLogger] Failed to log daily task:`, err);
      }
    });
  }
}

export const obsidianDailyLogger = new ObsidianDailyLogger();
