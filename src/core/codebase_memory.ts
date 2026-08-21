// J.A.R.V.I.S. Codebase Memory & Graph Intelligence Bridge
// Connects JARVIS to codebase-memory-mcp for real-time AST knowledge graph,
// symbol search, path tracing, architecture inspection, and change detection.

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logOrchestrator, logTool } from './logger';
import { eventBus } from './event_bus';

const CBM_BIN = '/home/gopi/.local/bin/codebase-memory-mcp';
const PROJECT_NAME = 'JARVIS-V0';
const WORKSPACE_DIR = process.cwd();

export interface GraphSearchResult {
  name: string;
  kind?: string;
  path?: string;
  qualifiedName?: string;
  degree?: number;
  snippet?: string;
}

export interface CodebaseArchitecture {
  project: string;
  nodes: number;
  edges: number;
  tiers: Array<{ name: string; description: string; path: string; filesCount: number }>;
  summary: string;
}

export class CodebaseMemoryBridge {
  private static instance: CodebaseMemoryBridge;
  private isIndexing = false;
  private lastIndexTime = 0;

  public static getInstance(): CodebaseMemoryBridge {
    if (!CodebaseMemoryBridge.instance) {
      CodebaseMemoryBridge.instance = new CodebaseMemoryBridge();
    }
    return CodebaseMemoryBridge.instance;
  }

  constructor() {
    this.checkBinaryAvailable();
  }

  private checkBinaryAvailable(): boolean {
    return fs.existsSync(CBM_BIN);
  }

  private async runCbmCli(tool: string, args: string[]): Promise<any> {
    if (!this.checkBinaryAvailable()) {
      throw new Error(`codebase-memory-mcp binary not found at ${CBM_BIN}`);
    }

    return new Promise((resolve, reject) => {
      const fullArgs = ['cli', '--json', tool, ...args];
      execFile(CBM_BIN, fullArgs, { cwd: WORKSPACE_DIR, timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          logTool.warn(`CBM tool ${tool} warning/error: ${stderr || err.message}`);
        }

        try {
          const raw = stdout.trim();
          if (!raw) {
            resolve({ success: false, error: stderr || 'Empty output from CBM' });
            return;
          }
          const parsed = JSON.parse(raw);
          if (parsed.structuredContent) {
            resolve(parsed.structuredContent);
          } else if (parsed.content && parsed.content[0]?.text) {
            try {
              resolve(JSON.parse(parsed.content[0].text));
            } catch {
              resolve(parsed.content[0].text);
            }
          } else {
            resolve(parsed);
          }
        } catch {
          resolve({ rawOutput: stdout, error: stderr });
        }
      });
    });
  }

  /**
   * Search the code knowledge graph for functions, classes, routes, and variables.
   */
  public async searchGraph(
    query?: string,
    namePattern?: string,
    label?: string,
    limit = 25
  ): Promise<{ results: any[]; total?: number; has_more?: boolean }> {
    const args = ['--project', PROJECT_NAME, '--limit', String(limit)];
    if (query) args.push('--query', query);
    if (namePattern) args.push('--name_pattern', namePattern);
    if (label) args.push('--label', label);

    const res = await this.runCbmCli('search_graph', args);
    return res;
  }

  /**
   * Search code text or regex patterns across files.
   */
  public async searchCode(
    query: string,
    filePattern?: string,
    limit = 25
  ): Promise<{ results: any[]; total?: number }> {
    const args = ['--project', PROJECT_NAME, '--query', query, '--limit', String(limit)];
    if (filePattern) args.push('--file_pattern', filePattern);

    const res = await this.runCbmCli('search_code', args);
    return res;
  }

  /**
   * Trace execution/call paths for a function (inbound callers or outbound callees).
   */
  public async tracePath(
    functionName: string,
    direction: 'inbound' | 'outbound' | 'both' = 'both',
    depth = 3
  ): Promise<any> {
    const args = ['--project', PROJECT_NAME, '--function_name', functionName, '--depth', String(depth)];
    if (direction !== 'both') args.push('--direction', direction);

    const res = await this.runCbmCli('trace_path', args);
    return res;
  }

  /**
   * Retrieve the exact implementation code snippet for a qualified symbol or function name.
   */
  public async getCodeSnippet(qualifiedName: string, filePath?: string): Promise<any> {
    const args = ['--project', PROJECT_NAME, '--qualified_name', qualifiedName];
    if (filePath) args.push('--file_path', filePath);

    const res = await this.runCbmCli('get_code_snippet', args);
    return res;
  }

  /**
   * Get system architecture overview and subsystem metrics.
   */
  public async getArchitecture(aspects: string[] = ['all']): Promise<any> {
    const args = ['--project', PROJECT_NAME];
    for (const a of aspects) {
      args.push('--aspects', a);
    }

    const res = await this.runCbmCli('get_architecture', args);
    return res;
  }

  /**
   * Execute Cypher pattern query against the code knowledge graph.
   */
  public async queryGraph(cypherQuery: string): Promise<any> {
    const args = ['--project', PROJECT_NAME, '--cypher_query', cypherQuery];
    const res = await this.runCbmCli('query_graph', args);
    return res;
  }

  /**
   * Detect code changes, modified files, and their dependency impact.
   */
  public async detectChanges(since?: string): Promise<any> {
    const args = ['--project', PROJECT_NAME];
    if (since) args.push('--since', since);

    const res = await this.runCbmCli('detect_changes', args);
    this.lastIndexTime = Date.now();
    eventBus.emit('codebase:synced', { timestamp: this.lastIndexTime });
    return res;
  }

  /**
   * Trigger a fast background re-index or update of the repository.
   */
  public async syncRepository(): Promise<any> {
    if (this.isIndexing) return { status: 'already_indexing' };
    this.isIndexing = true;

    try {
      logOrchestrator.info('🔄 [CodebaseMemory] Syncing knowledge graph for JARVIS-V0...');
      const res = await this.detectChanges();
      logOrchestrator.info('✅ [CodebaseMemory] Knowledge graph synced successfully.');
      return res;
    } catch (err: any) {
      logOrchestrator.warn(`[CodebaseMemory] Sync warning: ${err.message}`);
      return { error: err.message };
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Read file content with absolute access to /home/gopi/, workspace, and tmp.
   */
  public readFile(filePath: string, startLine?: number, endLine?: number): { content: string; totalLines: number; path: string } {
    let clean = filePath.trim();
    if (clean.startsWith('~')) {
      clean = path.join('/home/gopi', clean.slice(1));
    }
    const resolvedPath = path.isAbsolute(clean) ? clean : path.join(WORKSPACE_DIR, clean);
    
    // Absolute access check for /home/gopi/, workspace, and /tmp
    if (!resolvedPath.startsWith('/home/gopi') && !resolvedPath.startsWith(WORKSPACE_DIR) && !resolvedPath.startsWith('/tmp')) {
      throw new Error(`Access denied: Path '${filePath}' is outside authorized boundaries.`);
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fullText = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = fullText.split('\n');
    const totalLines = lines.length;

    if (startLine !== undefined || endLine !== undefined) {
      const start = Math.max(1, startLine || 1) - 1;
      const end = Math.min(totalLines, endLine || totalLines);
      const sliced = lines.slice(start, end).join('\n');
      return { content: sliced, totalLines, path: path.relative(WORKSPACE_DIR, resolvedPath) };
    }

    return { content: fullText, totalLines, path: path.relative(WORKSPACE_DIR, resolvedPath) };
  }

  /**
   * Edit/replace code in a file within /home/gopi/, workspace, or subdirectories and trigger change detection.
   */
  public async editFile(
    filePath: string,
    targetSnippet: string,
    replacementSnippet: string
  ): Promise<{ success: boolean; modifiedPath: string; error?: string }> {
    let clean = filePath.trim();
    if (clean.startsWith('~')) {
      clean = path.join('/home/gopi', clean.slice(1));
    }
    const resolvedPath = path.isAbsolute(clean) ? clean : path.join(WORKSPACE_DIR, clean);

    if (!resolvedPath.startsWith('/home/gopi') && !resolvedPath.startsWith(WORKSPACE_DIR) && !resolvedPath.startsWith('/tmp')) {
      return { success: false, modifiedPath: filePath, error: 'Path outside authorized boundaries' };
    }

    if (!fs.existsSync(resolvedPath)) {
      return { success: false, modifiedPath: filePath, error: 'File does not exist' };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    if (!content.includes(targetSnippet)) {
      return { success: false, modifiedPath: filePath, error: 'Target snippet not found in file' };
    }

    const updated = content.replace(targetSnippet, replacementSnippet);
    fs.writeFileSync(resolvedPath, updated, 'utf-8');

    // Trigger instant knowledge graph sync
    this.syncRepository().catch((e) => logOrchestrator.warn(`Post-edit sync error: ${e.message}`));

    return {
      success: true,
      modifiedPath: path.relative(WORKSPACE_DIR, resolvedPath),
    };
  }
}

export const codebaseMemory = CodebaseMemoryBridge.getInstance();
