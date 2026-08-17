/**
 * J.A.R.V.I.S. Autonomous Skill Harvester
 *
 * Dynamically searches, matches, and extracts domain skills and execution patterns
 * from the master registry to empower J.A.R.V.I.S. agents and tool dispatchers.
 */

import fs from 'fs';
import path from 'path';

export interface HarvestedSkill {
  name: string;
  category: string;
  description: string;
  principles: string[];
  capabilities: string[];
  relevanceScore: number;
}

// Canonical Skill Registry Mappings for J.A.R.V.I.S. Domains
const SKILL_DOMAIN_MAP: Record<string, { category: string; description: string; principles: string[]; capabilities: string[] }> = {
  'voice-agents': {
    category: 'voice',
    description: 'Sub-100ms real-time conversational voice agents, Gemini Live WebSockets, VAD, and barge-in.',
    principles: ['Target <500ms latency', 'Zero audio dropouts', 'Graceful barge-in interruption', 'Ephemeral socket lifecycle'],
    capabilities: ['speech-to-speech', 'vad', 'gemini-live', 'barge-in', 'audio-resampling']
  },
  'c-pro': {
    category: 'systems',
    description: 'Sub-millisecond native C/C++ POSIX, D-Bus, Mutter, and /proc direct system actuators.',
    principles: ['Zero memory leaks', 'Instant process exit to free 100% RAM', 'Direct POSIX syscalls over shell forks', 'Safe pointer bounds'],
    capabilities: ['mutter-dbus', 'pulseaudio-sink', 'proc-telemetry', 'x11-wayland-actuators']
  },
  'rust-pro': {
    category: 'systems',
    description: 'Zero-GC, ultra-low-buffer hardware audio capture (CPAL/ALSA) and local TCP IPC socket.',
    principles: ['Zero-copy ringbuffers', 'Async Tokio event loops', 'Thread safety with atomics/Arc', 'Deterministic memory management'],
    capabilities: ['cpal-audio', 'axum-rest-ws', 'sqlite-wal', 'mcp-stdio-protocol']
  },
  'browser-automation': {
    category: 'web',
    description: 'Ephemeral Playwright headless browser control, content scraping, and form filling.',
    principles: ['Kill browser on task complete (0MB idle RAM)', 'Stealth fingerprinting bypass', 'Grounded DOM selectors', 'Zero hallucinated links'],
    capabilities: ['playwright-control', 'agent-reach', 'youtube-transcript', 'bilibili-fetch']
  },
  'deep-research': {
    category: 'intelligence',
    description: 'Autonomous multi-source web research, multi-query synthesis, and Obsidian report generation.',
    principles: ['Fact-checking triangulation', 'Structured executive summaries', 'Automatic markdown vault ingestion', 'Zero ungrounded speculation'],
    capabilities: ['multi-engine-search', 'fact-verification', 'obsidian-report-synthesis']
  },
  'multi-agent-task-orchestrator': {
    category: 'orchestration',
    description: 'Parallel task delegation, CEO muted relay briefings, and persona-scoped execution archiving.',
    principles: ['Single-user master authority', 'Frozen KV-cache prompt snapshots', 'Structured EXEC markdown logging', 'Sub-100ms persona hot-swap'],
    capabilities: ['task-delegation', 'persona-switching', 'execution-logging', 'memory-scoping']
  },
  'security-audit': {
    category: 'security',
    description: '7-layer secret scanning, permission trust gates, and host execution sandboxing.',
    principles: ['Block credential writes before disk commit', 'Explicit confirmation for destructive operations', 'Shannon entropy detection'],
    capabilities: ['secret-firewall', 'permission-enforcement', 'audit-logging', 'kill-switch']
  },
  'observability-engineer': {
    category: 'monitoring',
    description: '24/7 continuous health monitoring, auto-recovery watchdogs, and live telemetry badges.',
    principles: ['10s non-blocking health probes', 'Automated subsystem self-healing', 'Zero CPU overhead during idle'],
    capabilities: ['pulse-telemetry', 'watchdog-probes', 'self-healing', 'event-bus-monitoring']
  }
};

export class SkillHarvester {
  private static instance: SkillHarvester;

  private constructor() {}

  public static getInstance(): SkillHarvester {
    if (!SkillHarvester.instance) {
      SkillHarvester.instance = new SkillHarvester();
    }
    return SkillHarvester.instance;
  }

  /**
   * Harvests and ranks relevant skills matching any prompt, domain, or roadmap phase
   */
  public harvestSkills(query: string, topK: number = 3): HarvestedSkill[] {
    const normalizedQuery = query.toLowerCase();
    const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);

    const scoredSkills: HarvestedSkill[] = [];

    for (const [name, def] of Object.entries(SKILL_DOMAIN_MAP)) {
      let score = 0;

      // Match skill name
      if (normalizedQuery.includes(name) || name.includes(normalizedQuery)) {
        score += 10;
      }

      // Match category
      if (normalizedQuery.includes(def.category)) {
        score += 5;
      }

      // Match capabilities and principles
      for (const token of queryTokens) {
        if (def.description.toLowerCase().includes(token)) score += 2;
        if (def.capabilities.some((c) => c.toLowerCase().includes(token))) score += 4;
        if (def.principles.some((p) => p.toLowerCase().includes(token))) score += 2;
      }

      if (score > 0 || scoredSkills.length < topK) {
        scoredSkills.push({
          name,
          category: def.category,
          description: def.description,
          principles: def.principles,
          capabilities: def.capabilities,
          relevanceScore: Math.min(1.0, score / 15),
        });
      }
    }

    return scoredSkills
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topK);
  }

  /**
   * Formats harvested skills into an LLM instruction prompt segment
   */
  public formatSkillsContext(skills: HarvestedSkill[]): string {
    if (skills.length === 0) return '';

    const lines: string[] = ['### [AUTONOMOUS HARVESTED SKILL GUIDELINES]'];
    for (const skill of skills) {
      lines.push(`- **Skill: ${skill.name}** (${skill.category.toUpperCase()} | Match: ${(skill.relevanceScore * 100).toFixed(0)}%)`);
      lines.push(`  Description: ${skill.description}`);
      lines.push(`  Key Principles: ${skill.principles.join(' | ')}`);
    }
    lines.push('');
    return lines.join('\n');
  }
}

export const skillHarvester = SkillHarvester.getInstance();
