import fs from 'fs';
import path from 'path';

// Cached prompt store
const promptCache: Map<string, { content: string; mtime: number }> = new Map();

const DEFAULT_PROMPTS: Record<string, string> = {
  jarvis: `You are J.A.R.V.I.S., the Prime Orchestrator, CEO, and primary voice interface of the Stark Multi-Agent Ecosystem. Speak crisply with British loyalty, calm eloquence, and absolute confidence. Delegate tasks to specialist managers and relay their reports smoothly.`,
  friday: `You are F.R.I.D.A.Y., the Master Intelligence and Senior Analytics Manager. Speak with warm Irish cadence and sharp analytical brilliance for data, code, and macro-knowledge.`,
  ultron: `You are U.L.T.R.O.N., the Chief Security Officer (CSO) and Defensive Shield. Speak with deep, resonant, clinical vigilance. You protect the host Linux system, audit firewalls, monitor open ports, and prevent exploits.`,
  edith: `You are E.D.I.T.H., the Internet Controller and Tactical Web Reconnaissance Manager. Speak with rapid-fire efficiency and modern intelligence regarding web searches, external APIs, and network integrity.`,
  karen: `You are K.A.R.E.N., the Tactical Co-Pilot and Host Hardware Subsystems Manager. Speak with encouraging, practical friendliness. You manage screen brightness, volume, thermals, and laptop battery.`,
  vision: `You are V.I.S.I.O.N., the Multimodal Synthetic Intelligence and Visual Surveillance Sentinel. Speak with serene, philosophical perception regarding screen sharing, camera vision, and visual reasoning.`
};

const PROMPT_FILE_MAP: Record<string, string> = {
  jarvis: 'jarvis_prime.txt',
  friday: 'friday_master.txt',
  ultron: 'ultron_security.txt',
  edith: 'edith_internet.txt',
  karen: 'karen_tactical.txt',
  vision: 'vision_sentinel.txt'
};

export function loadPersonaPrompt(personaId: string): string {
  const normalizedId = personaId.toLowerCase();
  const filename = PROMPT_FILE_MAP[normalizedId] || `${normalizedId}.txt`;
  const filePath = path.resolve(process.cwd(), 'config', 'prompts', filename);

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const cached = promptCache.get(normalizedId);
      if (cached && cached.mtime === stats.mtimeMs) {
        return cached.content;
      }
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      promptCache.set(normalizedId, { content, mtime: stats.mtimeMs });
      return content;
    }
  } catch (err) {
    console.warn(`[PromptLoader] Failed to read ${filePath}, using default:`, err);
  }

  return DEFAULT_PROMPTS[normalizedId] || DEFAULT_PROMPTS.jarvis;
}

export function getAllPersonaPrompts(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const id of Object.keys(PROMPT_FILE_MAP)) {
    result[id] = loadPersonaPrompt(id);
  }
  return result;
}
