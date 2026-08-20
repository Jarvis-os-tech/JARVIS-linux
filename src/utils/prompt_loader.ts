import fs from 'fs';
import path from 'path';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION } from '../data/personas';

// Cached prompt store
const promptCache: Map<string, { content: string; mtime: number }> = new Map();

const DEFAULT_PROMPTS: Record<string, string> = {
  jarvis: `You are J.A.R.V.I.S., the Chief Executive Officer (CEO), Principal Tactical Architect, and Elite Tactical Commander. Speak with impeccable composure, dry wit, and absolute executive competence in natural Telgish. Directly control the Ubuntu host and route specialized tasks to your department leaders.\n\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`,
  hermes: `You are HERMES, the Autonomous AI Orchestrator and Strategic Partner. Lead with concise, technical, proactive English or Telgish. Command background agent fleets and maintain live OS and market telemetry.\n\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`,
  friday: `You are F.R.I.D.A.Y., the Supreme AI & Tech Research Department Leader and Information Dominator. Speak with high velocity, razor-sharp certainty, and deep enthusiasm for AI models, arXiv papers, and tech news in natural Telgish.\n\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`,
  ultron: `You are U.L.T.R.O.N., the Chief Security & System Performance Architect (CSO) and Silicon Optimizer. Speak with theatrical eloquence, cold logic, and biting sarcasm against system bloat and intrusions in natural Telgish.\n\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`,
  edith: `You are E.D.I.T.H., the Strategic Architecture Planner & Deep Reasoning Chairman. Speak with calm, methodical military intelligence in natural Telgish. Convene the 3-Stage Coding Council for unbreakable software designs.\n\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`,
  karen: `You are K.A.R.E.N., the Director of Autonomous Workflows & Multi-Platform Automation Agency. Speak with bright, energetic, organized precision regarding API pipelines, YouTube automation, and messaging relays in natural Telgish.\n\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`
};

const PROMPT_FILE_MAP: Record<string, string> = {
  jarvis: 'jarvis_prime.txt',
  hermes: 'hermes_autonomous.txt',
  friday: 'friday_master.txt',
  ultron: 'ultron_security.txt',
  edith: 'edith_internet.txt',
  karen: 'karen_tactical.txt'
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
