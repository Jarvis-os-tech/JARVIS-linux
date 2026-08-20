// Hermes-Grade Progressive Skills Engine & Hub for J.A.R.V.I.S.
// Discovers, indexes, lints, and serves skills from local memory, Hermes, and master agent repositories.
// Follows progressive disclosure: lightweight metadata listing -> full on-demand SKILL.md inspection.

import fs from 'fs';
import path from 'path';
import { skillsRegistryRepo, SkillRegistryRecord } from '../db/db';
import { logSkill } from './logger';
import { eventBus } from './event_bus';

const LOCAL_SKILLS_DIR = path.join(process.cwd(), 'JARVIS-MEMORY', 'skills');
const HERMES_SKILLS_DIR = '/home/gopi/.hermes/skills';
const MASTER_SKILLS_DIR = '/home/gopi/Documents/jarvis-agents/skills';

export interface SkillSummary {
  name: string;
  category: string;
  description: string;
  usage_count: number;
  source: string;
}

export class SkillsEngine {
  private static instance: SkillsEngine;
  private indexed = false;

  public static getInstance(): SkillsEngine {
    if (!SkillsEngine.instance) {
      SkillsEngine.instance = new SkillsEngine();
    }
    return SkillsEngine.instance;
  }

  constructor() {
    this.ensureDirs();
    this.indexAllSkills();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(LOCAL_SKILLS_DIR)) {
      fs.mkdirSync(LOCAL_SKILLS_DIR, { recursive: true });
    }
  }

  /**
   * Scan and index skills across all repository roots into SQLite.
   */
  public indexAllSkills(): void {
    const roots = [
      { dir: LOCAL_SKILLS_DIR, source: 'user' as const },
      { dir: HERMES_SKILLS_DIR, source: 'bundled' as const },
      { dir: MASTER_SKILLS_DIR, source: 'bundled' as const },
    ];

    let count = 0;
    const now = Date.now();

    for (const { dir, source } of roots) {
      if (!fs.existsSync(dir)) continue;

      try {
        const scan = (currentDir: string, category = 'general') => {
          const entries = fs.readdirSync(currentDir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
              if (entry.name.startsWith('.')) continue;

              const skillMd = path.join(fullPath, 'SKILL.md');
              if (fs.existsSync(skillMd)) {
                // Found a skill directory
                this.indexSingleSkill(entry.name, category, skillMd, source, now);
                count++;
              } else {
                // Nested category directory
                scan(fullPath, entry.name);
              }
            }
          }
        };

        scan(dir);
      } catch (err: any) {
        logSkill.warn(`Error scanning skills in ${dir}: ${err.message}`);
      }
    }

    this.indexed = true;
    logSkill.info(`Indexed ${count} progressive skills into Skills Registry.`);
  }

  private indexSingleSkill(
    name: string,
    category: string,
    skillMdPath: string,
    source: 'bundled' | 'user' | 'harvested',
    now: number
  ): void {
    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      let description = 'Autonomous specialist skill.';

      // Extract description from frontmatter or first paragraph
      const descMatch = content.match(/description:\s*["']?([^"'\n\r]+)["']?/i);
      if (descMatch) {
        description = descMatch[1].trim();
      } else {
        const line = content.split('\n').find((l) => l.trim().length > 10 && !l.startsWith('#') && !l.startsWith('---'));
        if (line) description = line.trim().slice(0, 150);
      }

      skillsRegistryRepo.upsert({
        name,
        category,
        description,
        path: skillMdPath,
        source,
        usage_count: 0,
        content,
        updated_at: now,
      });
    } catch {
      // Ignore read errors
    }
  }

  /**
   * List all skills with progressive disclosure (metadata only).
   */
  public listSkills(category?: string): SkillSummary[] {
    const all = skillsRegistryRepo.getAll();
    return all
      .filter((s) => !category || s.category.toLowerCase() === category.toLowerCase())
      .map((s) => ({
        name: s.name,
        category: s.category,
        description: s.description,
        usage_count: s.usage_count,
        source: s.source,
      }));
  }

  /**
   * Return total count of registered progressive skills.
   */
  public getSkillCount(): number {
    return skillsRegistryRepo.getAll().length;
  }

  /**
   * Get full SKILL.md instructions for a specific skill on-demand.
   */
  public getSkill(name: string): { success: boolean; skill?: SkillRegistryRecord; error?: string } {
    const skill = skillsRegistryRepo.getByName(name);
    if (!skill) {
      return { success: false, error: `Skill "${name}" not found.` };
    }

    skillsRegistryRepo.incrementUsage(name);
    return { success: true, skill };
  }

  /**
   * Create or harvest a new skill.
   */
  public createSkill(name: string, category: string, description: string, content: string): { success: boolean; path: string } {
    const catDir = path.join(LOCAL_SKILLS_DIR, category, name);
    fs.mkdirSync(catDir, { recursive: true });

    const skillPath = path.join(catDir, 'SKILL.md');
    const fullDoc = `---
name: ${name}
category: ${category}
description: "${description}"
author: JARVIS Autonomous Harvester
---

# ${name}

${description}

${content}
`;
    fs.writeFileSync(skillPath, fullDoc, 'utf-8');

    skillsRegistryRepo.upsert({
      name,
      category,
      description,
      path: skillPath,
      source: 'harvested',
      usage_count: 1,
      content: fullDoc,
      updated_at: Date.now(),
    });

    eventBus.emit('skill:harvested', { name, category });
    logSkill.info(`Created new harvested skill: [${name}] in [${category}]`);
    return { success: true, path: skillPath };
  }

  /**
   * Search skills by keyword.
   */
  public searchSkills(query: string): SkillSummary[] {
    const results = skillsRegistryRepo.search(query);
    return results.map((s) => ({
      name: s.name,
      category: s.category,
      description: s.description,
      usage_count: s.usage_count,
      source: s.source,
    }));
  }
}

export const skillsEngine = SkillsEngine.getInstance();
