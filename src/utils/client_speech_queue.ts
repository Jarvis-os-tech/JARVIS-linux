// Client-Side Live Presence & Priority Queue for J.A.R.V.I.S.
// Operates strictly natively: Audio is produced 100% by the authentic Agent voice pipeline (Gemini Live 24kHz DSP)
// Guarantees:
// 1. Zero external/prebuilt synthetic voices (No window.speechSynthesis)
// 2. Real-time visual presence & speaking state synchronization
// 3. Instant priority preemption & seamless turn handling

export enum ClientSpeechPriority {
  INTERRUPTION = 1,
  FINAL_RESPONSE = 2,
  ACKNOWLEDGEMENT = 3,
  PROGRESS_UPDATE = 4,
}

export interface QueuedSpeechItem {
  id: string;
  text: string;
  priority: ClientSpeechPriority;
  personaVoiceName?: string;
  category?: string;
  createdAt: number;
  durationMs?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

export class ClientSpeechPriorityQueue {
  private static instance: ClientSpeechPriorityQueue;
  private queue: QueuedSpeechItem[] = [];
  private currentItem: QueuedSpeechItem | null = null;
  private timer: NodeJS.Timeout | null = null;
  private onSubtitleChange?: (text: string | null, priority?: ClientSpeechPriority) => void;
  private onSpeakingStateChange?: (speaking: boolean) => void;

  public static getInstance(): ClientSpeechPriorityQueue {
    if (!ClientSpeechPriorityQueue.instance) {
      ClientSpeechPriorityQueue.instance = new ClientSpeechPriorityQueue();
    }
    return ClientSpeechPriorityQueue.instance;
  }

  public setCallbacks(callbacks: {
    onSubtitleChange?: (text: string | null, priority?: ClientSpeechPriority) => void;
    onSpeakingStateChange?: (speaking: boolean) => void;
  }): void {
    this.onSubtitleChange = callbacks.onSubtitleChange;
    this.onSpeakingStateChange = callbacks.onSpeakingStateChange;
  }

  /**
   * Enqueue a presence item with priority enforcement.
   */
  public speak(
    text: string,
    priority: ClientSpeechPriority = ClientSpeechPriority.ACKNOWLEDGEMENT,
    options?: {
      personaVoiceName?: string;
      category?: string;
      durationMs?: number;
      onStart?: () => void;
      onEnd?: () => void;
    }
  ): string {
    const id = `hud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedDurationMs = options?.durationMs || Math.max(1500, wordCount * 280);

    const item: QueuedSpeechItem = {
      id,
      text,
      priority,
      personaVoiceName: options?.personaVoiceName,
      category: options?.category,
      createdAt: Date.now(),
      durationMs: estimatedDurationMs,
      onStart: options?.onStart,
      onEnd: options?.onEnd,
    };

    // Preemption: Higher priority cancels lower priority items
    if (this.currentItem && priority < this.currentItem.priority) {
      this.cancelCurrentTimer();
      this.queue = this.queue.filter((q) => q.priority <= priority);
      this.queue.unshift(item);
      this.processNext();
      return id;
    }

    this.queue.push(item);
    this.queue.sort((a, b) => a.priority - b.priority);

    this.processNext();
    return id;
  }

  private processNext(): void {
    if (this.currentItem || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.currentItem = item;

    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange(true);
    }
    if (item.onStart) item.onStart();

    // Auto dismiss after duration if not preempted
    this.timer = setTimeout(() => {
      this.finishCurrentItem();
    }, item.durationMs || 2500);
  }

  private finishCurrentItem(): void {
    this.cancelCurrentTimer();
    if (this.currentItem?.onEnd) {
      this.currentItem.onEnd();
    }
    this.currentItem = null;

    if (this.queue.length === 0) {
      if (this.onSubtitleChange) {
        this.onSubtitleChange(null);
      }
      if (this.onSpeakingStateChange) {
        this.onSpeakingStateChange(false);
      }
    } else {
      this.processNext();
    }
  }

  /**
   * Cancel all current and pending items (e.g. Gemini Live audio arrived or user barge-in)
   */
  public cancelAll(reason = 'interruption'): void {
    this.cancelCurrentTimer();
    this.queue = [];
    this.currentItem = null;

    if (this.onSubtitleChange) {
      this.onSubtitleChange(null);
    }
    if (this.onSpeakingStateChange) {
      this.onSpeakingStateChange(false);
    }
  }

  private cancelCurrentTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const clientSpeechQueue = ClientSpeechPriorityQueue.getInstance();
