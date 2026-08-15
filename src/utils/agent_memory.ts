export interface MemoryFact {
  id: string;
  category: 'preference' | 'personal_fact' | 'work_context' | 'topic' | 'custom';
  key: string;
  value: string;
  updatedAt: string;
  source: 'auto_extracted' | 'user_added';
}

export interface AgentMemoryState {
  enabled: boolean;
  facts: MemoryFact[];
  recentTopicsSummary: string;
  lastUpdated: string;
}

const STORAGE_KEY = 'jarvis_agent_memory_v1';

const DEFAULT_MEMORY_STATE: AgentMemoryState = {
  enabled: true,
  facts: [
    {
      id: 'fact-1',
      category: 'work_context',
      key: 'Project Focus',
      value: 'Building J.A.R.V.I.S. Multimodal Voice AI Studio',
      updatedAt: new Date().toISOString(),
      source: 'user_added'
    },
    {
      id: 'fact-2',
      category: 'preference',
      key: 'Communication Style',
      value: 'Concise, natural conversational speech with light warmth',
      updatedAt: new Date().toISOString(),
      source: 'user_added'
    }
  ],
  recentTopicsSummary: 'Voice companion setup, multimodal vision streaming, real-time WebSocket connection, and auto-lang detection.',
  lastUpdated: new Date().toISOString()
};

export function loadAgentMemory(): AgentMemoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEMORY_STATE;
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      facts: Array.isArray(parsed.facts) ? parsed.facts : DEFAULT_MEMORY_STATE.facts,
      recentTopicsSummary: parsed.recentTopicsSummary || DEFAULT_MEMORY_STATE.recentTopicsSummary,
      lastUpdated: parsed.lastUpdated || new Date().toISOString()
    };
  } catch (err) {
    console.error('Failed to load agent memory:', err);
    return DEFAULT_MEMORY_STATE;
  }
}

export function saveAgentMemory(state: AgentMemoryState): void {
  try {
    const updated = { ...state, lastUpdated: new Date().toISOString() };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
    // Asynchronously push to SQLite backend if in browser environment
    if (typeof fetch !== 'undefined') {
      for (const fact of state.facts) {
        fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fact),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Failed to save agent memory:', err);
  }
}

export async function syncAgentMemoryFromBackend(): Promise<AgentMemoryState> {
  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        if (data.memories && Array.isArray(data.memories) && data.memories.length > 0) {
          const formattedFacts: MemoryFact[] = data.memories.map((m: any) => ({
            id: m.id,
            category: m.category,
            key: m.key,
            value: m.value,
            updatedAt: m.updated_at,
            source: m.source,
          }));
          const current = loadAgentMemory();
          const mergedState: AgentMemoryState = {
            ...current,
            facts: formattedFacts,
            lastUpdated: new Date().toISOString(),
          };
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedState));
          }
          return mergedState;
        }
      }
    }
  } catch (e) {
    // Fallback gracefully
  }
  return loadAgentMemory();
}

export function formatMemoryForSystemInstruction(state: AgentMemoryState): string {
  if (!state.enabled) {
    return '[AGENT MEMORY CONTEXT: Long-term memory is currently disabled by user.]';
  }

  const factList = state.facts
    .map(f => `- [${f.category.toUpperCase()}] ${f.key}: ${f.value}`)
    .join('\n');

  return `
[AGENT LONG-TERM MEMORY & CONTEXT AWARENESS]
You have persistent long-term memory about this user across sessions. Maintain complete context awareness during interaction.

Known User Facts & Preferences:
${factList || '- No custom facts saved yet.'}

Recent Conversation Context Summary:
${state.recentTopicsSummary || '- Just started conversation.'}

BEHAVIOR INSTRUCTIONS FOR MEMORY:
1. Seamlessly use these memories and context to personalize responses without explicitly stating "According to my database...".
2. If the user refers to past context (e.g. "remember my project", "as we discussed"), draw directly from these memories.
3. If new facts or updates are mentioned, naturally acknowledge them.
`;
}

/**
 * Automatically inspects recent conversation text to extract facts and update topic summaries.
 */
export function autoExtractMemoriesFromText(
  userText: string,
  currentState: AgentMemoryState
): AgentMemoryState {
  if (!currentState.enabled || !userText || userText.trim().length < 4) {
    return currentState;
  }

  const text = userText.trim();
  let updatedFacts = [...currentState.facts];
  let factAdded = false;

  const patterns: { regex: RegExp; key: string; category: MemoryFact['category'] }[] = [
    { regex: /(?:my name is|i'm|call me|this is)\s+([A-Z][a-zA-Z\s]{1,20})/i, key: "User Name", category: 'personal_fact' },
    { regex: /(?:i work as|i am a|my job is)\s+([a-zA-Z\s]{2,30})/i, key: "Occupation / Role", category: 'work_context' },
    { regex: /(?:i am building|working on|creating|developing)\s+([a-zA-Z0-9\s.,-]{3,40})/i, key: "Current Project", category: 'work_context' },
    { regex: /(?:i live in|i'm based in|from)\s+([A-Z][a-zA-Z\s]{2,30})/i, key: "User Location", category: 'personal_fact' },
    { regex: /(?:i prefer|i like|i love|keep responses|always speak in)\s+([a-zA-Z0-9\s.,-]{3,40})/i, key: "User Preference", category: 'preference' },
    { regex: /(?:remember that|note that)\s+([a-zA-Z0-9\s.,-]{3,50})/i, key: "Important Note", category: 'custom' },
  ];

  for (const { regex, key, category } of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const extractedVal = match[1].trim();
      const existingIdx = updatedFacts.findIndex(f => f.key.toLowerCase() === key.toLowerCase());

      if (existingIdx >= 0) {
        updatedFacts[existingIdx] = {
          ...updatedFacts[existingIdx],
          value: extractedVal,
          updatedAt: new Date().toISOString(),
          source: 'auto_extracted'
        };
      } else {
        updatedFacts.push({
          id: `fact-auto-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          category,
          key,
          value: extractedVal,
          updatedAt: new Date().toISOString(),
          source: 'auto_extracted'
        });
      }
      factAdded = true;
    }
  }

  // Update recent topics summary if long enough
  let updatedSummary = currentState.recentTopicsSummary;
  if (text.length > 15) {
    const topicExcerpt = text.slice(0, 60);
    if (!updatedSummary.includes(topicExcerpt)) {
      const parts = updatedSummary ? updatedSummary.split(' | ') : [];
      parts.push(topicExcerpt);
      if (parts.length > 3) parts.shift();
      updatedSummary = parts.join(' | ');
    }
  }

  if (factAdded || updatedSummary !== currentState.recentTopicsSummary) {
    const newState: AgentMemoryState = {
      ...currentState,
      facts: updatedFacts,
      recentTopicsSummary: updatedSummary,
      lastUpdated: new Date().toISOString()
    };
    saveAgentMemory(newState);
    return newState;
  }

  return currentState;
}
