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
  private baseDir: string;
  private currentDailyFile: string = '';
  private currentDateStr: string = '';
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(vaultPath?: string) {
    const root = vaultPath || path.join(process.cwd(), 'JARVIS-MEMORY');
    this.baseDir = path.join(root, 'memory', 'Daily Logs');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
    } catch (err) {
      console.error('[ObsidianLogger] Failed to create Daily Logs directory:', err);
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
   * Checks if today's daily note exists. If not, creates it with frontmatter & structure.
   */
  public ensureDailyFileExists(): string {
    this.ensureDirectoryExists();
    const dateStr = this.getLocalDateString();
    const filePath = path.join(this.baseDir, `${dateStr}.md`);

    if (this.currentDailyFile === filePath && this.currentDateStr === dateStr && fs.existsSync(filePath)) {
      return filePath;
    }

    this.currentDailyFile = filePath;
    this.currentDateStr = dateStr;

    if (!fs.existsSync(filePath)) {
      const template = `---
title: Daily Memory Log - ${dateStr}
date: ${dateStr}
tags:
  - jarvis
  - memory
  - daily-log
type: daily-note
status: active
---

# 🧠 JARVIS Daily Operations & Memory Log — ${dateStr}

> [!NOTE] System State
> Autonomous Life OS & Memory Vault active. Synchronized with JARVIS Prime Orchestrator.

---

## 🎯 Daily Objectives & Active Tasks
- [ ] Active interaction session in progress

---

## 💬 Conversation & Interaction Log

---

## 🛠️ Tool Executions & System Actions

---

## 🤖 Multi-Agent Delegations & Relay Briefings

---

## 💡 Key Facts & User Context Extracted

`;
      try {
        fs.writeFileSync(filePath, template, 'utf8');
        console.log(`[ObsidianLogger] Initialized new daily log for ${dateStr} at ${filePath}`);
      } catch (err) {
        console.error('[ObsidianLogger] Error creating daily file:', err);
      }
    }

    return filePath;
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
   * Appends text under a specific Markdown heading in today's daily log.
   */
  private async appendUnderSection(sectionHeading: string, markdownContent: string): Promise<void> {
    return this.queueAppend(async () => {
      const filePath = this.ensureDailyFileExists();
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        // Match exact or prefix of heading (e.g. "## 💬 Conversation & Interaction")
        const headingPrefix = sectionHeading.split('&')[0].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const headingRegex = new RegExp(`(${headingPrefix}[^\\r\\n]*[\\r\\n]+)`, 'i');

        if (headingRegex.test(content)) {
          content = content.replace(headingRegex, `$1\n${markdownContent}\n`);
        } else {
          content += `\n\n${sectionHeading}\n\n${markdownContent}\n`;
        }

        fs.writeFileSync(filePath, content, 'utf8');
      } catch (err) {
        console.error(`[ObsidianLogger] Failed to append under section ${sectionHeading}:`, err);
      }
    });
  }

  /**
   * Logs a conversation turn (User prompt or Agent response).
   */
  public logConversationTurn(entry: ConversationTurnLog): Promise<void> {
    const time = this.getLocalTimeString(entry.timestamp || new Date());
    const isUser = entry.role === 'user';
    const speakerLabel = isUser
      ? `👤 **User**`
      : `🤖 **${entry.speaker || 'JARVIS'}**${entry.personaId ? ` *(${entry.personaId})*` : ''}`;

    let turnBlock = `* **\`[${time}]\`** ${speakerLabel}:\n`;
    const indented = entry.text
      .split('\n')
      .map(line => `  > ${line}`)
      .join('\n');
    turnBlock += `${indented}\n`;

    if (entry.toolsUsed && entry.toolsUsed.length > 0) {
      turnBlock += `  > [!tip]- *Triggered Tools: ${entry.toolsUsed.join(', ')}*\n`;
    }

    return this.appendUnderSection('## 💬 Conversation & Interaction Log', turnBlock);
  }

  /**
   * Logs a tool execution event.
   */
  public logToolExecution(entry: ToolExecutionLog): Promise<void> {
    const time = this.getLocalTimeString(entry.timestamp || new Date());
    const statusIcon = entry.success ? '✅' : '❌';
    const duration = entry.durationMs ? ` (${entry.durationMs}ms)` : '';

    let argsPreview = '';
    try {
      argsPreview = JSON.stringify(entry.args);
      if (argsPreview.length > 120) argsPreview = argsPreview.slice(0, 117) + '...';
    } catch {
      argsPreview = String(entry.args);
    }

    let toolBlock = `* **\`[${time}]\`** ${statusIcon} \`${entry.toolName}\`${duration}\n`;
    toolBlock += `  * **Args**: \`${argsPreview}\`\n`;
    if (entry.resultSummary) {
      const summaryClean = entry.resultSummary.length > 200 ? entry.resultSummary.slice(0, 197) + '...' : entry.resultSummary;
      toolBlock += `  * **Result**: ${summaryClean}\n`;
    }

    return this.appendUnderSection('## 🛠️ Tool Executions & System Actions', toolBlock);
  }

  /**
   * Logs an agent delegation event (e.g. ULTRON, FRIDAY, EDITH).
   */
  public logAgentDelegation(entry: AgentDelegationLog): Promise<void> {
    const time = this.getLocalTimeString(entry.timestamp || new Date());
    const badge = entry.severity === 'critical' ? '🔴 DANGER' : entry.severity === 'warning' ? '🟡 WARNING' : '🔵 INFO';

    let delegationBlock = `* **\`[${time}]\`** **[${badge}] ${entry.sourceManagerName}**: ${entry.relayedSummary}\n`;
    delegationBlock += `  * **Delegated Task**: \`${entry.task}\`\n`;

    return this.appendUnderSection('## 🤖 Multi-Agent Delegations & Relay Briefings', delegationBlock);
  }

  /**
   * Logs an extracted user fact or preference.
   */
  public logFactExtracted(entry: FactExtractedLog): Promise<void> {
    const time = this.getLocalTimeString(entry.timestamp || new Date());
    const factBlock = `* **\`[${time}]\`** \`[${entry.category.toUpperCase()}]\` **${entry.key}**: ${entry.value} *(Source: ${entry.source || 'auto_extracted'})*\n`;
    return this.appendUnderSection('## 💡 Key Facts & User Context Extracted', factBlock);
  }

  /**
   * Appends or updates a daily objective / checklist item.
   */
  public logDailyTask(taskName: string, completed: boolean = false): Promise<void> {
    const box = completed ? '[x]' : '[ ]';
    const taskLine = `- ${box} ${taskName}\n`;
    return this.appendUnderSection('## 🎯 Daily Objectives & Active Tasks', taskLine);
  }
}

export const obsidianDailyLogger = new ObsidianDailyLogger();
