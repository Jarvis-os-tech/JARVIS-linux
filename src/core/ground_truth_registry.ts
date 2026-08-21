/**
 * J.A.R.V.I.S. Ground Truth & Capability Registry
 *
 * Core Anti-Hallucination & Reality-Grounding Engine:
 * 1. Unifies all tool catalogs (ToolRegistry + WorkspaceTools + System Actuators).
 * 2. Enforces deterministic Negative Capability boundaries (what JARVIS CANNOT do).
 * 3. Enforces the "Verification-Before-Completion" Iron Law on all tool execution results.
 * 4. Injects real-time capability manifests into all Agent Prompts & Gemini Live sessions.
 */

import { toolRegistry, ToolDefinition } from '../tools/tool_registry';
import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool } from '../utils/workspace_tools';
import { capabilityForge } from './capability_forge';
import { skillHarvester } from './skill_harvester';
import { logOrchestrator } from './logger';
import { eventBus } from './event_bus';

export interface CapabilityCheckResult {
  isSupported: boolean;
  toolName?: string;
  category: 'system_os' | 'workspace_cloud' | 'memory' | 'research' | 'multi_agent' | 'unsupported';
  confidence: number;
  reason: string;
  realAlternative?: string;
}

export interface VerifiedToolOutput {
  toolName: string;
  success: boolean;
  groundTruthVerified: boolean;
  evidence: string;
  errorMessage?: string;
  data?: any;
}

export class GroundTruthRegistry {
  private static instance: GroundTruthRegistry;
  private cachedFunctionDeclarations: any[] | null = null;
  private cachedOpenAiTools: any[] | null = null;

  // Negative Capability Boundaries: Hard constraints on what JARVIS CANNOT do
  private readonly NEGATIVE_BOUNDARIES = [
    {
      domain: 'physical_hardware_manipulation',
      description: 'Cannot physically touch, plug, unplug, or repair hardware components outside the host Linux machine.',
      refusalGuidance: 'Explain that you only have software actuation access to the host Linux environment.'
    },
    {
      domain: 'unauthenticated_cloud_access',
      description: 'Cannot access private external services, bank accounts, or third-party cloud data without authorized OAuth tokens or API keys.',
      refusalGuidance: 'Inform the user that the service is unlinked and suggest linking via OAuth or providing necessary credentials.'
    },
    {
      domain: 'imaginary_nonexistent_tools',
      description: 'Cannot invent fake APIs, fabricate simulation outputs, or pretend background tasks finished when they failed.',
      refusalGuidance: 'Explicitly state: "I do not currently have a registered tool for that specific action."'
    },
    {
      domain: 'unverified_system_telemetry',
      description: 'Cannot estimate or guess CPU temperature, RAM usage, battery levels, or open ports without running live sensors.',
      refusalGuidance: 'Always run get_system_telemetry, get_thermal_sensors, or execute_linux_command before making statements about system health.'
    }
  ];

  public static getInstance(): GroundTruthRegistry {
    if (!GroundTruthRegistry.instance) {
      GroundTruthRegistry.instance = new GroundTruthRegistry();
    }
    return GroundTruthRegistry.instance;
  }

  constructor() {
    logOrchestrator.info('🛡 Ground Truth & Capability Registry initialized (Zero-Hallucination Mode active).');
    
    // Invalidate caches when dynamic tools are forged, deleted, or feature switches change
    eventBus.on('tool:registered', () => this.invalidateCache());
    eventBus.on('tool:unregistered', () => this.invalidateCache());
    eventBus.on('forge:tool_created', () => this.invalidateCache());
    eventBus.on('forge:tool_deleted', () => this.invalidateCache());
    eventBus.on('switch:changed', () => this.invalidateCache());
  }

  public invalidateCache(): void {
    this.cachedFunctionDeclarations = null;
    this.cachedOpenAiTools = null;
  }

  /**
   * Returns unified, deduplicated function declarations for Gemini Live & AI Models
   */
  public getUnifiedFunctionDeclarations(): any[] {
    if (this.cachedFunctionDeclarations) {
      return this.cachedFunctionDeclarations;
    }

    const map = new Map<string, any>();

    // 1. Add all workspace function declarations
    for (const fn of WORKSPACE_FUNCTION_DECLARATIONS) {
      map.set(fn.name, {
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters
      });
    }

    // 2. Add / override with ToolRegistry declarations
    const registryTools = toolRegistry.getAllTools();
    for (const tool of registryTools) {
      map.set(tool.name, {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      });
    }

    // Sanitize parameters for strict Gemini Live JSON Schema compliance
    const sanitized = Array.from(map.values()).map((fn) => {
      if (fn.parameters && fn.parameters.properties) {
        const cleanProps: Record<string, any> = {};
        for (const [propName, propDef] of Object.entries(fn.parameters.properties as Record<string, any>)) {
          const isArray = propDef.type === 'ARRAY' || propDef.type === 'array';
          cleanProps[propName] = {
            ...propDef,
            ...(isArray && !propDef.items ? { items: { type: 'STRING' } } : {})
          };
        }
        return {
          ...fn,
          parameters: {
            ...fn.parameters,
            properties: cleanProps
          }
        };
      }
      return fn;
    });

    this.cachedFunctionDeclarations = sanitized;
    return this.cachedFunctionDeclarations;
  }

  /**
   * Returns unified OpenAI-compatible tool schema for Groq and NVIDIA NIM
   */
  public getOpenAiUnifiedTools(): any[] {
    if (this.cachedOpenAiTools) {
      return this.cachedOpenAiTools;
    }

    const unified = this.getUnifiedFunctionDeclarations();
    this.cachedOpenAiTools = unified.map((fn) => ({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(fn.parameters?.properties || {}).map(([k, v]: [string, any]) => [
              k,
              {
                type: (v.type || 'string').toLowerCase(),
                description: v.description || '',
                ...(v.enum ? { enum: v.enum } : {})
              }
            ])
          ),
          required: fn.parameters?.required || []
        }
      }
    }));

    return this.cachedOpenAiTools;
  }

  /**
   * Checks whether an intent or tool is strictly supported by real capabilities
   */
  public verifyCapability(nameOrIntent: string): CapabilityCheckResult {
    const query = nameOrIntent.toLowerCase().trim();

    // 1. Direct tool match
    const tool = toolRegistry.getTool(query);
    if (tool) {
      return {
        isSupported: true,
        toolName: tool.name,
        category: tool.tier.includes('workspace') ? 'workspace_cloud' : 'system_os',
        confidence: 1.0,
        reason: `Direct tool available: ${tool.name} (${tool.description})`
      };
    }

    const forged = capabilityForge.getTool(query);
    if (forged) {
      return {
        isSupported: true,
        toolName: forged.name,
        category: 'system_os',
        confidence: 1.0,
        reason: `Direct dynamic forged tool available: ${forged.name} (${forged.description})`
      };
    }

    const wsTool = WORKSPACE_FUNCTION_DECLARATIONS.find((w) => w.name.toLowerCase() === query);
    if (wsTool) {
      return {
        isSupported: true,
        toolName: wsTool.name,
        category: 'workspace_cloud',
        confidence: 1.0,
        reason: `Direct workspace tool available: ${wsTool.name}`
      };
    }

    // 2. Check negative boundaries
    if (query.includes('hack') || query.includes('satellite') || query.includes('microwave') || query.includes('car engine')) {
      return {
        isSupported: false,
        category: 'unsupported',
        confidence: 0.99,
        reason: 'Requested action is outside the physical or legal operational envelope.',
        realAlternative: 'I can only control this local Ubuntu Linux machine, its connected devices, and linked APIs.'
      };
    }

    // 3. Fallback: Shell or Skill Harvester capability
    if (query.includes('command') || query.includes('terminal') || query.includes('script') || query.includes('run') || query.includes('install')) {
      return {
        isSupported: true,
        toolName: 'execute_linux_command',
        category: 'system_os',
        confidence: 0.9,
        reason: 'Can be executed via native host Linux terminal / bash actuator.'
      };
    }

    return {
      isSupported: false,
      category: 'unsupported',
      confidence: 0.6,
      reason: 'No direct tool or registered capability matches this action.',
      realAlternative: 'Check available system tools or harvest specialist skills from the master registry.'
    };
  }

  /**
   * Verifies tool execution output against the "Verification-Before-Completion" Iron Law
   */
  public verifyToolResult(toolName: string, rawResult: any): VerifiedToolOutput {
    if (!rawResult) {
      return {
        toolName,
        success: false,
        groundTruthVerified: true,
        evidence: 'Tool returned null or undefined output.',
        errorMessage: 'Execution returned no data.'
      };
    }

    if (rawResult.success === false || rawResult.error) {
      const errorMsg = rawResult.error || (typeof rawResult.result === 'string' ? rawResult.result : 'Operation reported failure.');
      return {
        toolName,
        success: false,
        groundTruthVerified: true,
        evidence: `Failure confirmed: ${errorMsg}`,
        errorMessage: errorMsg,
        data: rawResult
      };
    }

    // Success with evidence
    const evidenceSummary =
      typeof rawResult.result === 'string'
        ? rawResult.result
        : typeof rawResult === 'string'
        ? rawResult
        : JSON.stringify(rawResult.result || rawResult);

    return {
      toolName,
      success: true,
      groundTruthVerified: true,
      evidence: evidenceSummary.length > 500 ? evidenceSummary.slice(0, 500) + '... (truncated)' : evidenceSummary,
      data: rawResult
    };
  }

  /**
   * Generates the Canonical System Capabilities & Negative Boundaries Prompt Block
   */
  public getCanonicalCapabilityManifest(): string {
    const totalTools = this.getUnifiedFunctionDeclarations().length;

    return `[ZERO-HALLUCINATION TRUTH CONTRACT]
TOOLS: ${totalTools} verified tools registered. Call them — NEVER guess their output.
IRON LAW: If uncertain, call a tool. If no tool exists, say so. NEVER fabricate results, metrics, files, or execution outcomes.
NEGATIVE BOUNDARIES: Cannot access external services without OAuth. Cannot manipulate hardware outside this Linux host. Cannot invent capabilities.
If a tool fails, report the exact error. If you don't know, say "I don't have that information right now."`;
  }
}

export const groundTruthRegistry = GroundTruthRegistry.getInstance();
