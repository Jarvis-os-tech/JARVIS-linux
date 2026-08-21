// Capability Forge & Sandboxed Self-Extension Engine (Ada-SI Implementation)
// Enables J.A.R.V.I.S. to autonomously detect capability gaps, synthesize, test,
// verify in Linux bwrap sandboxes, and hot-reload new tools/features directly at runtime.

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { eventBus } from './event_bus';
import { logTool, logOrchestrator } from './logger';
import { toolRegistry, ToolDefinition } from '../tools/tool_registry';
import { skillsEngine } from './skills_engine';

export type PromotionStatus = 'EXPERIMENTAL' | 'TESTING' | 'CANARY' | 'TRUSTED' | 'QUARANTINED';

export interface CapabilityGap {
  userIntent: string;
  suggestedName: string;
  description: string;
  requiredInputs: { name: string; type: string; description: string; required?: boolean }[];
  expectedOutput: string;
  uiLayout?: 'table' | 'calendar' | 'list' | 'chart' | 'custom' | 'none';
}

export interface ToolPlan {
  name: string;
  description: string;
  parameters: Record<string, any>;
  requirements: string[];
  uiLayout?: string;
  rationale: string;
}

export interface ForgedTool {
  name: string;
  description: string;
  code: string;
  testCode: string;
  requirements: string[];
  status: PromotionStatus;
  schema: Record<string, any>;
  uiLayout?: string;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastError?: string;
}

const CUSTOM_TOOLS_DIR = path.join(process.cwd(), 'custom_tools');
const FORGE_DATA_DIR = path.join(CUSTOM_TOOLS_DIR, 'data');
const PYTHON_EXEC = path.join(CUSTOM_TOOLS_DIR, '.forge_venv', 'bin', 'python3');
const SYSTEM_PYTHON = '/usr/bin/python3';

export class CapabilityForge {
  private static instance: CapabilityForge;
  private tools: Map<string, ForgedTool> = new Map();

  public static getInstance(): CapabilityForge {
    if (!CapabilityForge.instance) {
      CapabilityForge.instance = new CapabilityForge();
    }
    return CapabilityForge.instance;
  }

  constructor() {
    this.ensureDirectories();
    setImmediate(() => this.loadInstalledTools());
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(CUSTOM_TOOLS_DIR)) {
      fs.mkdirSync(CUSTOM_TOOLS_DIR, { recursive: true });
    }
    if (!fs.existsSync(FORGE_DATA_DIR)) {
      fs.mkdirSync(FORGE_DATA_DIR, { recursive: true });
    }
  }

  private getPythonBinary(): string {
    if (fs.existsSync(PYTHON_EXEC)) return PYTHON_EXEC;
    return SYSTEM_PYTHON;
  }

  /**
   * Load all existing custom tools from disk and register them into the live tool registry.
   */
  public loadInstalledTools(): void {
    if (!fs.existsSync(CUSTOM_TOOLS_DIR)) return;

    const files = fs.readdirSync(CUSTOM_TOOLS_DIR);
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.manifest.json')) {
        const manifestPath = path.join(CUSTOM_TOOLS_DIR, file);
        try {
          const manifest: ForgedTool = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          const pyPath = path.join(CUSTOM_TOOLS_DIR, `${manifest.name}.py`);
          const testPath = path.join(CUSTOM_TOOLS_DIR, `${manifest.name}.test.py`);

          if (fs.existsSync(pyPath)) {
            manifest.code = fs.readFileSync(pyPath, 'utf-8');
            manifest.testCode = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf-8') : '';
            this.tools.set(manifest.name, manifest);

            if (manifest.status !== 'QUARANTINED') {
              this.registerIntoToolRegistry(manifest);
              count++;
            }
          }
        } catch (err: any) {
          logTool.warn(`Error loading custom tool manifest ${file}: ${err.message}`);
        }
      }
    }

    logOrchestrator.info(`Capability Forge loaded ${count} active custom tools into registry.`);
  }

  /**
   * Register a dynamic tool into J.A.R.V.I.S. live Tool Registry.
   */
  private registerIntoToolRegistry(tool: ForgedTool): void {
    const toolDef: ToolDefinition = {
      name: tool.name,
      description: `[FORGED TOOL - ${tool.status}] ${tool.description}`,
      tier: 'tier2_system_shell',
      parameters: tool.schema?.parameters || {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async (args: Record<string, any>) => {
        return this.executeForgedTool(tool.name, args);
      },
    };

    toolRegistry.hotRegisterDynamicTool(toolDef);
  }

  /**
   * Execute a forged tool in the secure sandbox and track execution metrics.
   */
  public async executeForgedTool(toolName: string, args: Record<string, any>): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { success: false, error: `Forged tool '${toolName}' not found in registry.` };
    }

    if (tool.status === 'QUARANTINED') {
      return {
        success: false,
        error: `Tool '${toolName}' is QUARANTINED due to previous unhandled runtime failures.`,
      };
    }

    const script = `
import sys, json, os
from core_engine.forge_sandbox import forge_sandbox
import asyncio

async def main():
    res = await forge_sandbox.execute_tool("${toolName}", ${JSON.stringify(args)})
    print(json.dumps(res))

asyncio.run(main())
`;

    const py = this.getPythonBinary();
    return new Promise((resolve) => {
      execFile(
        py,
        ['-c', script],
        { timeout: 25000, cwd: process.cwd() },
        (error, stdout, stderr) => {
          tool.executionCount = (tool.executionCount || 0) + 1;

          if (error) {
            tool.failureCount = (tool.failureCount || 0) + 1;
            tool.lastError = stderr || error.message;
            this.evaluatePromotion(tool);
            this.saveManifest(tool);
            resolve({ success: false, error: tool.lastError });
            return;
          }

          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed.success) {
              tool.successCount = (tool.successCount || 0) + 1;
              this.evaluatePromotion(tool);
              this.saveManifest(tool);
              resolve(parsed);
            } else {
              tool.failureCount = (tool.failureCount || 0) + 1;
              tool.lastError = parsed.error || 'Execution failed';
              this.evaluatePromotion(tool);
              this.saveManifest(tool);
              resolve(parsed);
            }
          } catch {
            tool.successCount = (tool.successCount || 0) + 1;
            this.evaluatePromotion(tool);
            this.saveManifest(tool);
            resolve({ success: true, result: stdout.trim() });
          }
        }
      );
    });
  }

  /**
   * Evaluate tool promotion status based on reliability metrics.
   * EXPERIMENTAL (0-3 runs) -> TESTING (4-9) -> CANARY (10-24) -> TRUSTED (25+)
   */
  private evaluatePromotion(tool: ForgedTool): void {
    const total = tool.executionCount;
    const successes = tool.successCount;
    const failures = tool.failureCount;

    // If failure rate exceeds 50% after at least 3 runs, quarantine tool
    if (total >= 3 && failures / total > 0.5) {
      tool.status = 'QUARANTINED';
      logTool.warn(`Tool '${tool.name}' has been QUARANTINED due to high failure rate (${failures}/${total}).`);
      eventBus.emit('forge:tool_quarantined', { name: tool.name, failures, total });
      return;
    }

    if (total >= 25 && successes / total >= 0.95) {
      tool.status = 'TRUSTED';
    } else if (total >= 10 && successes / total >= 0.9) {
      tool.status = 'CANARY';
    } else if (total >= 4 && successes / total >= 0.8) {
      tool.status = 'TESTING';
    } else {
      tool.status = 'EXPERIMENTAL';
    }
  }

  private saveManifest(tool: ForgedTool): void {
    const manifestPath = path.join(CUSTOM_TOOLS_DIR, `${tool.name}.manifest.json`);
    const cleanCopy = { ...tool };
    delete (cleanCopy as any).code;
    delete (cleanCopy as any).testCode;
    fs.writeFileSync(manifestPath, JSON.stringify(cleanCopy, null, 2), 'utf-8');
  }

  /**
   * Run AST security audit on Python tool code via Python AST auditor.
   */
  public async runAstAudit(code: string): Promise<{ valid: boolean; errors: string[]; warnings: string[]; schema?: any }> {
    const script = `
import json, sys
from core_engine.tool_ast_auditor import tool_ast_auditor
code = ${JSON.stringify(code)}
res = tool_ast_auditor.audit_tool_code(code)
print(json.dumps(res))
`;
    const py = this.getPythonBinary();
    return new Promise((resolve) => {
      execFile(py, ['-c', script], { timeout: 10000, cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) {
          resolve({ valid: false, errors: [stderr || err.message], warnings: [] });
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ valid: false, errors: ['Failed to parse AST audit response'], warnings: [] });
        }
      });
    });
  }

  /**
   * Verify newly forged code in the ephemeral sandbox.
   */
  public async verifyInSandbox(
    toolName: string,
    code: string,
    testCode: string,
    requirements: string[] = []
  ): Promise<{ passed: boolean; error?: string; stdout?: string; stderr?: string }> {
    const script = `
import json, sys, asyncio
from core_engine.forge_sandbox import forge_sandbox

async def main():
    res = await forge_sandbox.verify_tool(
        tool_name="${toolName}",
        tool_code=${JSON.stringify(code)},
        test_code=${JSON.stringify(testCode)},
        requirements=${JSON.stringify(requirements)}
    )
    print(json.dumps(res))

asyncio.run(main())
`;
    const py = this.getPythonBinary();
    return new Promise((resolve) => {
      execFile(py, ['-c', script], { timeout: 35000, cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) {
          resolve({ passed: false, error: stderr || err.message, stderr });
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ passed: false, error: 'Sandbox verification produced non-JSON output', stdout });
        }
      });
    });
  }

  /**
   * Install and hot-reload a verified forged tool.
   */
  public async installTool(
    name: string,
    description: string,
    code: string,
    testCode: string,
    requirements: string[] = [],
    uiLayout = 'none'
  ): Promise<{ success: boolean; tool?: ForgedTool; error?: string }> {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // 1. Run AST Audit
    const audit = await this.runAstAudit(code);
    if (!audit.valid) {
      return { success: false, error: `AST Audit Failed: ${audit.errors.join(', ')}` };
    }

    // 2. Run Sandbox Verification
    const testResult = await this.verifyInSandbox(cleanName, code, testCode, requirements);
    if (!testResult.passed) {
      return { success: false, error: `Sandbox Test Failed: ${testResult.error || testResult.stderr}` };
    }

    // 3. Write Files
    this.ensureDirectories();
    fs.writeFileSync(path.join(CUSTOM_TOOLS_DIR, `${cleanName}.py`), code, 'utf-8');
    fs.writeFileSync(path.join(CUSTOM_TOOLS_DIR, `${cleanName}.test.py`), testCode, 'utf-8');
    if (requirements.length > 0) {
      fs.writeFileSync(path.join(CUSTOM_TOOLS_DIR, `${cleanName}.requirements.txt`), requirements.join('\n') + '\n', 'utf-8');
    }

    const toolObj: ForgedTool = {
      name: cleanName,
      description,
      code,
      testCode,
      requirements,
      status: 'EXPERIMENTAL',
      schema: audit.schema || {
        name: cleanName,
        description,
        parameters: { type: 'object', properties: {}, required: [] },
      },
      uiLayout,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
    };

    this.saveManifest(toolObj);
    this.tools.set(cleanName, toolObj);

    // 4. Hot-Reload into Tool Registry
    this.registerIntoToolRegistry(toolObj);

    // 5. Index into Obsidian Skills Vault
    try {
      skillsEngine.createSkill(
        cleanName,
        'capability_forge',
        description,
        `## Tool Implementation\n\`\`\`python\n${code}\n\`\`\`\n\n## Verification Tests\n\`\`\`python\n${testCode}\n\`\`\``
      );
    } catch (err: any) {
      logTool.warn(`Could not sync forged skill to memory vault: ${err.message}`);
    }

    eventBus.emit('forge:tool_created', { name: cleanName, description, status: 'EXPERIMENTAL' });
    logOrchestrator.info(`Successfully forged and hot-reloaded tool '${cleanName}'.`);

    return { success: true, tool: toolObj };
  }

  /**
   * List all forged tools.
   */
  public listTools(): ForgedTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific forged tool.
   */
  public getTool(name: string): ForgedTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Delete and uninstall a forged tool.
   */
  public deleteTool(name: string): { success: boolean; error?: string } {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool '${name}' not found.` };
    }

    const extensions = ['.py', '.test.py', '.manifest.json', '.requirements.txt', '.ui.json'];
    for (const ext of extensions) {
      const p = path.join(CUSTOM_TOOLS_DIR, `${name}${ext}`);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }

    this.tools.delete(name);
    toolRegistry.hotUnregisterTool(name);
    eventBus.emit('forge:tool_deleted', { name });
    logOrchestrator.info(`Deleted forged tool '${name}'.`);

    return { success: true };
  }
}

export const capabilityForge = CapabilityForge.getInstance();
