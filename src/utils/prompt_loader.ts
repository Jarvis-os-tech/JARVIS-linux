import fs from 'fs';
import path from 'path';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION, JARVIS_SYSTEM_INSTRUCTION } from '../data/personas';

// Cached prompt store
const promptCache: Map<string, { content: string; mtime: number }> = new Map();

const DEFAULT_PROMPTS: Record<string, string> = {
  jarvis: JARVIS_SYSTEM_INSTRUCTION,
};

const PROMPT_FILE_MAP: Record<string, string> = {
  jarvis: 'jarvis_prime.txt',
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
