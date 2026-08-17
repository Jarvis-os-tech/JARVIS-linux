import { exec } from 'child_process';
import util from 'util';
import { memoryClient } from './client';
import { logOrchestrator } from '../core/logger';

const execAsync = util.promisify(exec);

export class GitMemorySyncer {
  private static instance: GitMemorySyncer;
  private lastCommitHash: string = '';
  private syncTimer: NodeJS.Timeout | null = null;

  public static getInstance(): GitMemorySyncer {
    if (!GitMemorySyncer.instance) {
      GitMemorySyncer.instance = new GitMemorySyncer();
    }
    return GitMemorySyncer.instance;
  }

  constructor() {}

  public start(intervalMs: number = 30000): void {
    if (this.syncTimer) return;
    this.syncRecentGitState().catch(() => {});
    this.syncTimer = setInterval(() => {
      this.syncRecentGitState().catch(() => {});
    }, intervalMs);
    logOrchestrator.info('[GitMemorySyncer] 🌿 Git commit memory syncer initialized.');
  }

  public async syncRecentGitState(): Promise<void> {
    try {
      // 1. Get current branch and last commit
      const { stdout: logOut } = await execAsync('git log -n 1 --pretty=format:"%H|%an|%ad|%s" 2>/dev/null || true');
      if (!logOut || !logOut.trim()) return;

      const [hash, author, date, subject] = logOut.trim().split('|');
      if (hash === this.lastCommitHash) return;

      this.lastCommitHash = hash;

      // 2. Get modified files in this commit
      const { stdout: diffOut } = await execAsync(`git show --stat --oneline ${hash} 2>/dev/null || true`);

      const { stdout: branchOut } = await execAsync('git branch --show-current 2>/dev/null || echo "main"');
      const branch = branchOut.trim() || 'main';

      logOrchestrator.info(`[GitMemorySyncer] Indexing git commit ${hash.slice(0, 7)}: "${subject}"`);

      // 3. Store in Universal Memory Engine
      await memoryClient.createNode({
        id: `git-${hash.slice(0, 12)}`,
        title: `[Git Commit] ${subject}`,
        content: `Commit Hash: ${hash}\nBranch: ${branch}\nAuthor: ${author}\nDate: ${date}\nMessage: ${subject}\n\nDiff Summary:\n${diffOut}`,
        kind: 'system',
        tier: 'working',
        importance: 0.75,
        scope: 'global',
        tags: ['git', 'commit', branch],
      });
    } catch (err: any) {
      // Non-fatal if not in git repo or git command fails
      logOrchestrator.debug(`[GitMemorySyncer] Git sync warning: ${err.message}`);
    }
  }

  public stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
}

export const gitMemorySyncer = GitMemorySyncer.getInstance();
