export interface MemoryFact {
  id: string;
  category: 'preference' | 'personal_fact' | 'work_context' | 'topic' | 'custom';
  key: string;
  value: string;
  updatedAt: string;
  source: 'auto_extracted' | 'user_added' | 'agent_sync';
  agentId?: 'jarvis' | 'friday' | 'ultron' | 'edith' | 'karen' | 'user' | string;
  agentName?: string;
}

export interface AgentMemoryState {
  enabled: boolean;
  facts: MemoryFact[];
  recentTopicsSummary: string;
  lastUpdated: string;
}

export const DEFAULT_SEED_MEMORIES: MemoryFact[] = [
  {
    id: 'mem-user-profile-gopi',
    category: 'personal_fact',
    key: 'Operator Identity & Engineering Profile',
    value: 'User name is Gopi. BTech Computer Science engineer specializing in autonomous multi-system agent architectures and local-first systems. Work cycle: 09:00 AM - 18:30 PM IST.',
    updatedAt: '2026-06-21T00:00:00.000Z',
    source: 'agent_sync',
    agentId: 'user',
    agentName: 'OPERATOR'
  },
  {
    id: 'mem-user-obsidian-localfirst',
    category: 'preference',
    key: 'Obsidian Vault & Local-First Architecture',
    value: 'User prefers Obsidian markdown vaults (/JARVIS-MEMORY/) as primary truth store. Strict local-first architecture prioritizing native POSIX/C++ workers and SQLite over cloud dependencies.',
    updatedAt: '2026-06-18T00:00:00.000Z',
    source: 'agent_sync',
    agentId: 'user',
    agentName: 'OPERATOR'
  },
  {
    id: 'mem-user-browser-chrome',
    category: 'preference',
    key: 'Browser Automation Standards',
    value: 'Always use standard Google Chrome (never Beta/unstable channels) for browser automations, Playwright workflows, and web inspection.',
    updatedAt: '2026-06-21T00:00:00.000Z',
    source: 'agent_sync',
    agentId: 'user',
    agentName: 'OPERATOR'
  },
  {
    id: 'mem-ultron-sentinel',
    category: 'work_context',
    key: 'ULTRON Security & Isolation Baseline',
    value: 'Linux firewall policies active. Listening ports 3000 (HTTP/WebSocket Live Bridge) authorized. Mutter D-Bus and X11 display subsystems monitored. Zero privilege escalation vectors detected.',
    updatedAt: new Date().toISOString(),
    source: 'agent_sync',
    agentId: 'ultron',
    agentName: 'ULTRON Sentinel'
  },
  {
    id: 'mem-friday-briefing',
    category: 'topic',
    key: 'FRIDAY Executive Briefing Schedule',
    value: 'Morning Executive Briefing is configured as primary operational objective. Automates calendar triage, unread high-priority emails, and system health status synthesis.',
    updatedAt: new Date().toISOString(),
    source: 'agent_sync',
    agentId: 'friday',
    agentName: 'FRIDAY Executive'
  },
  {
    id: 'mem-jarvis-core',
    category: 'preference',
    key: 'JARVIS Core Multilingual Protocol',
    value: 'Real-time bidirectional speech auto-detection active with Telgish primary mode. Immediate conversational adaptation to user language with Puck voice synthesis.',
    updatedAt: new Date().toISOString(),
    source: 'agent_sync',
    agentId: 'jarvis',
    agentName: 'JARVIS Core'
  },
  {
    id: 'mem-edith-actuators',
    category: 'work_context',
    key: 'EDITH System Actuators & POSIX Workers',
    value: 'C++ POSIX worker binaries compiled in /workers_cpp/. Direct Mutter D-Bus, PulseAudio, and /proc actuators provide sub-millisecond execution with zero RAM persistence.',
    updatedAt: new Date().toISOString(),
    source: 'agent_sync',
    agentId: 'edith',
    agentName: 'EDITH Tactical Recon'
  }
];

const STORAGE_KEY = 'jarvis_agent_memory_v1';

const DEFAULT_MEMORY_STATE: AgentMemoryState = {
  enabled: true,
  facts: DEFAULT_SEED_MEMORIES,
  recentTopicsSummary: '',
  lastUpdated: new Date().toISOString()
};

export function loadAgentMemory(): AgentMemoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEMORY_STATE;
    const parsed = JSON.parse(raw);
    // Filter out any legacy dummy facts
    const rawFacts = Array.isArray(parsed.facts) ? parsed.facts : [];
    const cleanFacts = rawFacts.filter(
      (f: MemoryFact) => f && f.id !== 'fact-1' && f.id !== 'fact-2' && f.key !== 'Project Focus'
    );
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      facts: cleanFacts.length > 0 ? cleanFacts : DEFAULT_SEED_MEMORIES,
      recentTopicsSummary: parsed.recentTopicsSummary || '',
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
