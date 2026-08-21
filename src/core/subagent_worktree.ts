// Git Worktree Isolation for Delegated Subagents in J.A.R.V.I.S.
// Ensures parallel subagents (e.g. FRIDAY writing code, ULTRON auditing) never contend
// for the working tree or dirty the master branch.
// Ported and enhanced from Hermes (tools/subagent_worktree.py)

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logOrchestrator } from './logger';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  worktreePath: string;
  branch: string;
  repoRoot: string;
  isIsolated: boolean;
  commitsAhead?: number;
  isDirty?: boolean;
}

export class SubagentWorktreeManager {
  private static instance: SubagentWorktreeManager;

  public static getInstance(): SubagentWorktreeManager {
    if (!SubagentWorktreeManager.instance) {
      SubagentWorktreeManager.instance = new SubagentWorktreeManager();
    }
    return SubagentWorktreeManager.instance;
  }

  /**
   * Check if a directory is inside a Git repository.
   */
  public async getRepoRoot(cwd: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd, timeout: 5000 });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Create an isolated Git worktree for a subagent task.
   */
  public async createWorktree(subagentId: string, baseCwd: string = process.cwd()): Promise<WorktreeInfo> {
    const repoRoot = await this.getRepoRoot(baseCwd);
    if (!repoRoot) {
      logOrchestrator.debug(`Subagent [${subagentId}] running in non-git directory. Worktree isolation skipped.`);
      return {
        worktreePath: baseCwd,
        branch: 'main',
        repoRoot: baseCwd,
        isIsolated: false
      };
    }

    const worktreesDir = path.join(repoRoot, '.worktrees');
    const worktreePath = path.join(worktreesDir, `agent-${subagentId}`);
    const branchName = `jarvis-agent/${subagentId}`;

    try {
      if (!fs.existsSync(worktreesDir)) {
        fs.mkdirSync(worktreesDir, { recursive: true });
      }

      // Add worktree from HEAD
      await execFileAsync('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
        cwd: repoRoot,
        timeout: 15000
      });

      logOrchestrator.info(`Created isolated Git worktree for [${subagentId}] at: ${worktreePath} (branch: ${branchName})`);

      return {
        worktreePath,
        branch: branchName,
        repoRoot,
        isIsolated: true
      };
    } catch (err: any) {
      logOrchestrator.warn(`Failed to create git worktree for [${subagentId}] (${err.message}). Falling back to parent repo.`);
      return {
        worktreePath: repoRoot,
        branch: 'HEAD',
        repoRoot,
        isIsolated: false
      };
    }
  }

  /**
   * Clean up or inspect worktree after subagent completion.
   */
  public async cleanupWorktree(info: WorktreeInfo): Promise<{ cleaned: boolean; commitsAhead: number; isDirty: boolean }> {
    if (!info.isIsolated || !fs.existsSync(info.worktreePath)) {
      return { cleaned: false, commitsAhead: 0, isDirty: false };
    }

    try {
      // Check for uncommitted changes
      const statusRes = await execFileAsync('git', ['status', '--porcelain'], { cwd: info.worktreePath });
      const isDirty = statusRes.stdout.trim().length > 0;

      // Check commits ahead of parent branch
      let commitsAhead = 0;
      try {
        const countRes = await execFileAsync('git', ['rev-list', '--count', `HEAD...${info.branch}`], { cwd: info.repoRoot });
        commitsAhead = parseInt(countRes.stdout.trim(), 10) || 0;
      } catch {
        // rev-list calculation fallback
      }

      if (!isDirty && commitsAhead === 0) {
        // Clean and no work -> prune automatically
        await execFileAsync('git', ['worktree', 'remove', '--force', info.worktreePath], { cwd: info.repoRoot });
        try {
          await execFileAsync('git', ['branch', '-D', info.branch], { cwd: info.repoRoot });
        } catch {
          // branch delete fallback
        }
        logOrchestrator.info(`Pruned clean unused worktree for branch: ${info.branch}`);
        return { cleaned: true, commitsAhead: 0, isDirty: false };
      }

      logOrchestrator.info(`Preserved active worktree holding code changes at [${info.worktreePath}] (${commitsAhead} commits, dirty: ${isDirty})`);
      return { cleaned: false, commitsAhead, isDirty };
    } catch (err: any) {
      logOrchestrator.warn(`Error during worktree inspection: ${err.message}`);
      return { cleaned: false, commitsAhead: 0, isDirty: false };
    }
  }
}

export const subagentWorktreeManager = SubagentWorktreeManager.getInstance();
