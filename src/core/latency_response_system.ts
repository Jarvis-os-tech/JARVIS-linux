import { logVoice, logOrchestrator } from './logger';
import { eventBus } from './event_bus';

export type TaskTier = 'INSTANT' | 'SHORT' | 'LONG';
export type TaskCategory = 'research' | 'coding' | 'system_ops' | 'multi_agent' | 'general_long' | 'short' | 'instant';

export type TaskLifecycleState =
  | 'CREATED'
  | 'CLASSIFIED'
  | 'ACKNOWLEDGED'
  | 'PROCESSING'
  | 'PROGRESS_UPDATING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'INTERRUPTED';

export enum SpeechPriority {
  INTERRUPTION = 1,
  FINAL_RESPONSE = 2,
  ACKNOWLEDGEMENT = 3,
  PROGRESS_UPDATE = 4,
}

export interface TaskClassificationResult {
  tier: TaskTier;
  category: TaskCategory;
  estimatedDurationMs: number;
  confidence: number;
  reason: string;
}

export interface TaskLifecycleRecord {
  taskId: string;
  userRequest?: string;
  toolName?: string;
  state: TaskLifecycleState;
  classification: TaskClassificationResult;
  createdAt: number;
  acknowledgedAt?: number;
  completedAt?: number;
  progressUpdatesCount: number;
  acknowledgementText?: string;
  acknowledgementLatencyMs?: number;
  durationMs?: number;
  cancellationReason?: string;
}

export interface LatencySystemConfig {
  longTaskThresholdMs: number;
  firstProgressDelayMs: number;
  progressIntervalMs: number;
  maxProgressUpdates: number;
  lruHistorySize: number;
}

export const DEFAULT_LATENCY_CONFIG: LatencySystemConfig = {
  longTaskThresholdMs: 3000,
  firstProgressDelayMs: 6000,
  progressIntervalMs: 7000,
  maxProgressUpdates: 3,
  lruHistorySize: 8,
};

// --- 1. Task Complexity Classifier ---
export class TaskComplexityClassifier {
  private static readonly INSTANT_PATTERNS = [
    /^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|greetings|jarvis|friday|edith|ultron)[\s!?.]*$/i,
    /^(who\s+are\s+you|what\s+time\s+is\s+it|what('s|\s+is)\s+your\s+name|status\s+check|system\s+status)[\s!?.]*$/i,
    /^(set|turn|change|adjust)\s+(the\s+)?(volume|sound|audio|brightness|display)\s+(to\s+)?\d+%/i,
    /^(mute|unmute)\s+(the\s+)?(volume|audio|sound|mic)?[\s!?.]*$/i,
    /^(open|launch|start|close|quit|kill)\s+([a-zA-Z0-9_-]+)[\s!?.]*$/i,
    /^(take\s+a\s+screenshot|capture\s+screen|battery\s+status|battery\s+level)[\s!?.]*$/i,
    /^(yes|no|ok|okay|cancel|stop|pause|resume|sure|thanks|thank\s+you)[\s!?.]*$/i,
    /^\[(GREETING|SYSTEM|VOICE_TRANSFER|DYNAMIC_GREETING)/i,
    /\b(greet\s+the\s+user|welcome\s+the\s+user|say\s+hello)\b/i,
  ];

  private static readonly RESEARCH_PATTERNS = [
    /\b(research|search\s+(the\s+web|online|internet)|look\s+up|find\s+out|investigate|compare|deep\s+dive|fact\s+check|verify\s+claim)\b/i,
    /\b(latest\s+(news|updates|developments|papers|models|breakthroughs))\b/i,
    /\b(what\s+are\s+the\s+top|tell\s+me\s+about\s+the\s+history\s+of|explain\s+in\s+detail)\b/i,
    /\b(arxiv|youtube\s+transcript|scrape|webpage|documentation)\b/i,
  ];

  private static readonly CODING_PATTERNS = [
    /\b(code|coding|refactor|debug|fix\s+the\s+bug|implement|pull\s+request|git\s+commit|repository|build\s+a\s+script)\b/i,
    /\b(analyze\s+(the\s+)?(code|project|codebase|function|class)|write\s+(a\s+)?(python|javascript|typescript|c\+\+|rust)\s+code)\b/i,
    /\b(database\s+migration|unit\s+test|lint\s+and\s+fix|github\s+issue)\b/i,
  ];

  private static readonly SYSTEM_OPS_PATTERNS = [
    /\b(backup|restore|install\s+package|upgrade\s+system|clean\s+cache|reclaim\s+ram|systemd\s+service)\b/i,
    /\b(run\s+diagnostics|full\s+security\s+audit|port\s+scan|firewall\s+rules|compile\s+workers|suit\s+diagnostic|pre-?flight\s+check|check\s+everything|recheck(\s+the)?\s+full\s+jarvis\s+os|system\s+motham\s+check|os\s+motham\s+test|all\s+systems\s+check)\b/i,
  ];

  private static readonly MULTI_AGENT_PATTERNS = [
    /\b(delegate\s+to|ask\s+(edith|friday|ultron|karen)|assign\s+to|multi-agent|swarm)\b/i,
  ];

  public classify(input: { text?: string; toolName?: string; toolArgs?: any }): TaskClassificationResult {
    const text = (input.text || '').trim();
    const tool = (input.toolName || '').trim().toLowerCase();

    // 1. Tool-based deterministic classification
    if (tool) {
      if (
        tool.includes('research') ||
        tool.includes('verify_claim') ||
        tool.includes('fast_fact_check') ||
        tool.includes('youtube') ||
        tool.includes('fetch_verified') ||
        tool.includes('search_internet')
      ) {
        return {
          tier: 'LONG',
          category: 'research',
          estimatedDurationMs: 8000,
          confidence: 0.98,
          reason: `Tool '${tool}' is an external web search/research tool.`,
        };
      }

      if (
        tool.includes('github') ||
        tool.includes('code') ||
        tool.includes('harvest_skills') ||
        tool.includes('refactor')
      ) {
        return {
          tier: 'LONG',
          category: 'coding',
          estimatedDurationMs: 10000,
          confidence: 0.95,
          reason: `Tool '${tool}' performs multi-step code or repository operations.`,
        };
      }

      if (
        tool.includes('delegate') ||
        tool.includes('agent') ||
        tool.includes('swarm') ||
        tool.includes('linkedin')
      ) {
        return {
          tier: 'LONG',
          category: 'multi_agent',
          estimatedDurationMs: 12000,
          confidence: 0.95,
          reason: `Tool '${tool}' dispatches to external API / specialist agent.`,
        };
      }

      if (
        tool.includes('execute_linux_command') ||
        tool.includes('system_control') ||
        tool.includes('launch_application') ||
        tool.includes('set_system_volume') ||
        tool.includes('set_display_brightness') ||
        tool.includes('get_system_telemetry') ||
        tool.includes('inspect_memory')
      ) {
        return {
          tier: 'INSTANT',
          category: 'instant',
          estimatedDurationMs: 250,
          confidence: 0.92,
          reason: `Tool '${tool}' is an instant C++ / local OS actuator.`,
        };
      }

      return {
        tier: 'SHORT',
        category: 'short',
        estimatedDurationMs: 1500,
        confidence: 0.85,
        reason: `Tool '${tool}' classified as short operational task.`,
      };
    }

    // 2. Text-based heuristic classification
    if (!text) {
      return {
        tier: 'INSTANT',
        category: 'instant',
        estimatedDurationMs: 100,
        confidence: 0.9,
        reason: 'Empty input defaults to instant.',
      };
    }

    // Check Instant patterns first
    for (const pat of TaskComplexityClassifier.INSTANT_PATTERNS) {
      if (pat.test(text)) {
        return {
          tier: 'INSTANT',
          category: 'instant',
          estimatedDurationMs: 300,
          confidence: 0.95,
          reason: `Matched instant intent pattern: ${pat.source}`,
        };
      }
    }

    // Check Multi-Agent patterns
    for (const pat of TaskComplexityClassifier.MULTI_AGENT_PATTERNS) {
      if (pat.test(text)) {
        return {
          tier: 'LONG',
          category: 'multi_agent',
          estimatedDurationMs: 10000,
          confidence: 0.94,
          reason: 'Matched multi-agent delegation pattern.',
        };
      }
    }

    // Check Research patterns
    for (const pat of TaskComplexityClassifier.RESEARCH_PATTERNS) {
      if (pat.test(text)) {
        return {
          tier: 'LONG',
          category: 'research',
          estimatedDurationMs: 8000,
          confidence: 0.93,
          reason: 'Matched research intent pattern.',
        };
      }
    }

    // Check Coding patterns
    for (const pat of TaskComplexityClassifier.CODING_PATTERNS) {
      if (pat.test(text)) {
        return {
          tier: 'LONG',
          category: 'coding',
          estimatedDurationMs: 9000,
          confidence: 0.92,
          reason: 'Matched coding / development intent pattern.',
        };
      }
    }

    // Check System Ops patterns
    for (const pat of TaskComplexityClassifier.SYSTEM_OPS_PATTERNS) {
      if (pat.test(text)) {
        return {
          tier: 'LONG',
          category: 'system_ops',
          estimatedDurationMs: 7000,
          confidence: 0.9,
          reason: 'Matched system operations pattern.',
        };
      }
    }

    // Length-based heuristic: Very long or complex sentences are usually multi-part
    if (text.length > 120 || text.split(/\s+/).length > 25) {
      return {
        tier: 'LONG',
        category: 'general_long',
        estimatedDurationMs: 6000,
        confidence: 0.88,
        reason: 'Long complex prompt with multiple instructions.',
      };
    }

    // Default conversational query
    return {
      tier: 'INSTANT',
      category: 'instant',
      estimatedDurationMs: 500,
      confidence: 0.85,
      reason: 'General short query.',
    };
  }
}

// --- 2. Immediate Acknowledgement Manager ---
export class ImmediateAcknowledgementManager {
  private recentPhrases: string[] = [];
  private historyLimit: number;

  private static readonly PHRASE_POOLS: Record<TaskCategory, string[]> = {
    research: [
      "Let me look into that properly.",
      "I'm gathering the information now.",
      "Searching across the knowledge base now.",
      "Looking into this right away.",
      "Checking the latest sources for you.",
      "Let me pull up the research on that.",
    ],
    coding: [
      "Give me a moment. I'm analyzing the codebase.",
      "Working through the code logic now.",
      "Let me analyze this before making changes.",
      "Reviewing the implementation now.",
      "Examining the code structure.",
      "Working on the code implementation now.",
    ],
    system_ops: [
      "Hold on. I'm taking care of the system operation.",
      "Working on the system task now.",
      "Executing the system commands now.",
      "Processing the system request.",
      "Applying the requested system changes.",
      "Handling the system operation now.",
    ],
    multi_agent: [
      "This requires a bit more work. I'm handling it.",
      "Give me a moment. I'm coordinating the necessary tasks.",
      "Delegating this to the right specialist. One moment.",
      "Engaging the specialist team now.",
      "Coordinating with the team. I'll be right back with the result.",
      "Assigning this to the right subsystem.",
    ],
    general_long: [
      "Give me a second. I'm working on it.",
      "Hold on. Let me handle that.",
      "One moment. I'm processing it now.",
      "This may take a moment. I'll get it done.",
      "Working on it.",
      "Give me a moment. There's a bit to process.",
      "Let me handle this. I'll be right back with the result.",
    ],
    short: [
      "Right away.",
      "On it.",
      "One moment.",
    ],
    instant: [],
  };

  constructor(historyLimit = 8) {
    this.historyLimit = historyLimit;
  }

  public getAcknowledgementPhrase(category: TaskCategory): string {
    const pool = ImmediateAcknowledgementManager.PHRASE_POOLS[category] || ImmediateAcknowledgementManager.PHRASE_POOLS.general_long;
    if (pool.length === 0) return '';

    // Filter out recently used phrases to avoid consecutive repeats
    const available = pool.filter((p) => !this.recentPhrases.includes(p));
    const selectionPool = available.length > 0 ? available : pool;

    const randomIndex = Math.floor(Math.random() * selectionPool.length);
    const chosen = selectionPool[randomIndex];

    this.recordPhrase(chosen);
    return chosen;
  }

  private recordPhrase(phrase: string): void {
    this.recentPhrases.push(phrase);
    if (this.recentPhrases.length > this.historyLimit) {
      this.recentPhrases.shift();
    }
  }

  public clearHistory(): void {
    this.recentPhrases = [];
  }
}

// --- 3. Progress Update Manager ---
export class ProgressUpdateManager {
  private activeTimers: Map<string, NodeJS.Timeout[]> = new Map();
  private config: LatencySystemConfig;
  private recentProgressPhrases: string[] = [];

  private static readonly EARLY_PROGRESS = [
    "Still working on it.",
    "I'm on it.",
    "Continuing the analysis.",
    "Processing the details now.",
  ];

  private static readonly MID_PROGRESS = [
    "I'm gathering the remaining information.",
    "Processing the remaining parts.",
    "Still compiling the details.",
    "Analyzing the data now.",
  ];

  private static readonly LATE_PROGRESS = [
    "Almost done.",
    "Finishing this up.",
    "Just wrapping up the final steps.",
    "Nearly complete.",
  ];

  constructor(config: LatencySystemConfig = DEFAULT_LATENCY_CONFIG) {
    this.config = config;
  }

  public scheduleProgressUpdates(
    taskId: string,
    onProgress: (updateText: string, updateIndex: number, elapsedMs: number) => void
  ): void {
    this.cancel(taskId);

    const timers: NodeJS.Timeout[] = [];
    const startTime = Date.now();

    for (let i = 0; i < this.config.maxProgressUpdates; i++) {
      const delay = this.config.firstProgressDelayMs + i * this.config.progressIntervalMs;

      const timer = setTimeout(() => {
        const elapsed = Date.now() - startTime;
        const phrase = this.selectProgressPhrase(i);
        onProgress(phrase, i + 1, elapsed);
      }, delay);

      timers.push(timer);
    }

    this.activeTimers.set(taskId, timers);
  }

  private selectProgressPhrase(updateIndex: number): string {
    const pool =
      updateIndex === 0
        ? ProgressUpdateManager.EARLY_PROGRESS
        : updateIndex === 1
        ? ProgressUpdateManager.MID_PROGRESS
        : ProgressUpdateManager.LATE_PROGRESS;

    const available = pool.filter((p) => !this.recentProgressPhrases.includes(p));
    const selection = available.length > 0 ? available : pool;
    const chosen = selection[Math.floor(Math.random() * selection.length)];

    this.recentProgressPhrases.push(chosen);
    if (this.recentProgressPhrases.length > 6) {
      this.recentProgressPhrases.shift();
    }

    return chosen;
  }

  public cancel(taskId: string): boolean {
    const timers = this.activeTimers.get(taskId);
    if (timers) {
      timers.forEach((t) => clearTimeout(t));
      this.activeTimers.delete(taskId);
      return true;
    }
    return false;
  }

  public isTracking(taskId: string): boolean {
    return this.activeTimers.has(taskId);
  }
}

// --- 4. Unified Task Lifecycle & Latency Response System ---
export class LatencyResponseSystem {
  private static instance: LatencyResponseSystem;

  public readonly classifier: TaskComplexityClassifier;
  public readonly acknowledgementManager: ImmediateAcknowledgementManager;
  public readonly progressManager: ProgressUpdateManager;
  public readonly config: LatencySystemConfig;

  private tasks: Map<string, TaskLifecycleRecord> = new Map();
  private activeLongTaskId: string | null = null;

  public static getInstance(config?: Partial<LatencySystemConfig>): LatencyResponseSystem {
    if (!LatencyResponseSystem.instance) {
      LatencyResponseSystem.instance = new LatencyResponseSystem(config);
    }
    return LatencyResponseSystem.instance;
  }

  constructor(config?: Partial<LatencySystemConfig>) {
    this.config = { ...DEFAULT_LATENCY_CONFIG, ...config };
    this.classifier = new TaskComplexityClassifier();
    this.acknowledgementManager = new ImmediateAcknowledgementManager(this.config.lruHistorySize);
    this.progressManager = new ProgressUpdateManager(this.config);

    logVoice.info('Latency-Aware Voice Response System initialized (<5ms classification, zero-wait acknowledgements).');
  }

  /**
   * Process a request immediately and dispatch an instant voice acknowledgement if task is LONG.
   */
  public handleIncomingRequest(
    input: { text?: string; toolName?: string; toolArgs?: any },
    dispatchAcknowledgement?: (phrase: string, record: TaskLifecycleRecord) => void
  ): TaskLifecycleRecord {
    const taskId = `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startMs = Date.now();

    const classification = this.classifier.classify(input);
    const record: TaskLifecycleRecord = {
      taskId,
      userRequest: input.text,
      toolName: input.toolName,
      state: 'CLASSIFIED',
      classification,
      createdAt: startMs,
      progressUpdatesCount: 0,
    };

    this.tasks.set(taskId, record);

    if (classification.tier === 'LONG') {
      this.activeLongTaskId = taskId;
      const phrase = this.acknowledgementManager.getAcknowledgementPhrase(classification.category);
      record.acknowledgementText = phrase;
      record.acknowledgedAt = Date.now();
      record.acknowledgementLatencyMs = Date.now() - startMs;
      record.state = 'ACKNOWLEDGED';

      logVoice.info(`[LatencyEngine] LONG task detected (${classification.category}). Speaking immediate acknowledgement: "${phrase}" (Latency: ${record.acknowledgementLatencyMs}ms)`);

      eventBus.emit('voice:acknowledgement', {
        taskId,
        text: phrase,
        category: classification.category,
        priority: SpeechPriority.ACKNOWLEDGEMENT,
        latencyMs: record.acknowledgementLatencyMs,
      });

      if (dispatchAcknowledgement) {
        dispatchAcknowledgement(phrase, record);
      }

      // Schedule progress feedback
      this.progressManager.scheduleProgressUpdates(taskId, (progressPhrase, updateIndex, elapsedMs) => {
        if (record.state === 'COMPLETED' || record.state === 'CANCELLED' || record.state === 'INTERRUPTED') {
          return;
        }

        record.state = 'PROGRESS_UPDATING';
        record.progressUpdatesCount++;

        logVoice.info(`[LatencyEngine] Progress update #${updateIndex} for ${taskId} (+${Math.round(elapsedMs / 1000)}s): "${progressPhrase}"`);

        eventBus.emit('task:progress_update', {
          taskId,
          text: progressPhrase,
          updateIndex,
          elapsedMs,
        });
      });
    } else {
      record.state = 'PROCESSING';
    }

    return record;
  }

  /**
   * Complete a task and immediately halt all scheduled progress updates.
   */
  public completeTask(taskId: string, result?: any): TaskLifecycleRecord | undefined {
    const record = this.tasks.get(taskId);
    if (!record) return undefined;

    const fromState = record.state;
    record.state = 'COMPLETED';
    record.completedAt = Date.now();
    record.durationMs = record.completedAt - record.createdAt;

    this.progressManager.cancel(taskId);
    if (this.activeLongTaskId === taskId) {
      this.activeLongTaskId = null;
    }

    logVoice.info(`[LatencyEngine] Task completed: ${taskId} in ${record.durationMs}ms (Progress updates sent: ${record.progressUpdatesCount})`);

    eventBus.emit('task:lifecycle_change', {
      taskId,
      fromState,
      toState: 'COMPLETED',
    });

    return record;
  }

  /**
   * Complete currently active long task if any exists
   */
  public completeActiveTask(result?: any): TaskLifecycleRecord | undefined {
    if (this.activeLongTaskId) {
      return this.completeTask(this.activeLongTaskId, result);
    }
    return undefined;
  }

  /**
   * Cancel or interrupt task (e.g. user barge-in)
   */
  public interruptActiveTask(reason = 'user_interruption'): TaskLifecycleRecord | null {
    if (!this.activeLongTaskId) return null;

    const taskId = this.activeLongTaskId;
    const record = this.tasks.get(taskId);
    if (!record) return null;

    const fromState = record.state;
    record.state = 'INTERRUPTED';
    record.cancellationReason = reason;
    record.completedAt = Date.now();
    record.durationMs = record.completedAt - record.createdAt;

    this.progressManager.cancel(taskId);
    this.activeLongTaskId = null;

    logVoice.warn(`[LatencyEngine] Task interrupted: ${taskId} | Reason: ${reason}`);

    eventBus.emit('task:lifecycle_change', {
      taskId,
      fromState,
      toState: 'INTERRUPTED',
      reason,
    });

    return record;
  }

  public getTask(taskId: string): TaskLifecycleRecord | undefined {
    return this.tasks.get(taskId);
  }

  public getActiveLongTaskId(): string | null {
    return this.activeLongTaskId;
  }
}

export const latencyResponseSystem = LatencyResponseSystem.getInstance();
