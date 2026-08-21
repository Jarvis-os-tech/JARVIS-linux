// Dynamic Learning Mutations & Skill Synthesizer for J.A.R.V.I.S.
// Generates, refines, and persists learned domain skills into JARVIS-MEMORY/skills/ and SQLite.
// Ported and enhanced from Hermes (agent/learning_mutations.py)

import fs from 'fs';
import path from 'path';
import { skillsRegistryRepo } from '../db/db';
import { logSkill } from './logger';
import { learningGraph } from './learning_graph';

const LOCAL_SKILLS_DIR = path.join(process.cwd(), 'JARVIS-MEMORY', 'skills');

export interface DynamicSkillDraft {
  name: string;
  category: string;
  description: string;
  instructions: string;
  relatedSkills?: string[];
}

export class LearningMutationsEngine {
  private static instance: LearningMutationsEngine;

  public static getInstance(): LearningMutationsEngine {
    if (!LearningMutationsEngine.instance) {
      LearningMutationsEngine.instance = new LearningMutationsEngine();
    }
    return LearningMutationsEngine.instance;
  }

  constructor() {
    if (!fs.existsSync(LOCAL_SKILLS_DIR)) {
      fs.mkdirSync(LOCAL_SKILLS_DIR, { recursive: true });
    }
  }

  /**
   * Synthesize and persist a new learned skill from execution reflection.
   */
  public synthesizeSkill(draft: DynamicSkillDraft): string {
    const slug = draft.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const skillDir = path.join(LOCAL_SKILLS_DIR, slug);

    if (!fs.existsSync(skillDir)) {
      fs.mkdirSync(skillDir, { recursive: true });
    }

    const skillPath = path.join(skillDir, 'SKILL.md');
    const content = `---
name: ${draft.name}
category: ${draft.category || 'dynamic_learning'}
description: ${draft.description}
source: learned
related_skills: ${JSON.stringify(draft.relatedSkills || [])}
created_at: ${new Date().toISOString()}
---

# ${draft.name}

${draft.description}

## Procedural Instructions
${draft.instructions}
`;

    fs.writeFileSync(skillPath, content, 'utf-8');

    // Register in SQLite
    skillsRegistryRepo.upsertSkill({
      name: draft.name,
      category: draft.category || 'dynamic_learning',
      description: draft.description,
      path: skillPath,
      source: 'user',
      created_by: 'jarvis_learning_mutations'
    });

    // Update Learning Graph
    learningGraph.addOrUpdateNode({
      id: `skill:${slug}`,
      type: 'skill',
      label: draft.name,
      category: draft.category,
      useCount: 1,
      metadata: { path: skillPath }
    });

    logSkill.info(`Synthesized new learned skill: ${draft.name} at ${skillPath}`);
    return skillPath;
  }
}

export const learningMutations = LearningMutationsEngine.getInstance();
