import { logTool } from '../core/logger';
import { switchManager } from '../core/switch_manager';
import { eventBus } from '../core/event_bus';
import { auditRepo } from '../db/db';
import { executeSystemWorkerDirect, executeLinuxActuator } from '../utils/system_controller';

export type ToolTier = 'tier1_native_cpp' | 'tier2_system_shell' | 'tier3_browser' | 'tier4_workspace_cloud';

export interface ToolDefinition {
  name: string;
  description: string;
  tier: ToolTier;
  parameters: {
    type: 'object' | 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
  timeoutMs?: number;
  featureSwitchId?: string;
  handler: (args: any, context?: any) => Promise<any>;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  durationMs: number;
  result?: any;
  error?: string;
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  constructor() {
    this.registerCoreTools();
    logTool.info(`Tool Registry initialized with ${this.tools.size} registered tools.`);
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, {
      ...tool,
      timeoutMs: tool.timeoutMs || (tool.tier === 'tier1_native_cpp' ? 2000 : 15000),
    });
    logTool.debug(`Registered tool: ${tool.name} [${tool.tier}]`);
  }

  public hotRegisterDynamicTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, {
      ...tool,
      timeoutMs: tool.timeoutMs || 25000,
    });
    logTool.info(`[Capability Forge] Hot-registered dynamic tool: ${tool.name}`);
    eventBus.emit('tool:registered', { name: tool.name, tier: tool.tier });
  }

  public hotUnregisterTool(name: string): boolean {
    const deleted = this.tools.delete(name);
    if (deleted) {
      logTool.info(`[Capability Forge] Unregistered dynamic tool: ${name}`);
      eventBus.emit('tool:unregistered', { name });
    }
    return deleted;
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getFunctionDeclarations(): any[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  public async execute(name: string, args: any = {}, context?: any): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    const start = performance.now();

    if (!tool) {
      const err = `Tool '${name}' not found in registry.`;
      logTool.error(err);
      auditRepo.log('TOOL', 'error', err, { toolName: name, args });
      return { toolName: name, success: false, durationMs: 0, error: err };
    }

    // Feature switch enforcement
    if (tool.featureSwitchId && !switchManager.isEnabled(tool.featureSwitchId)) {
      const err = `Tool '${name}' is disabled by feature switch '${tool.featureSwitchId}'.`;
      logTool.warn(err);
      return { toolName: name, success: false, durationMs: 0, error: err };
    }

    eventBus.emit('tool:before_execute', { toolName: name, args, tier: tool.tier });
    logTool.info(`Executing tool: ${name} [${tool.tier}]`, { args });

    try {
      // Execute with timeout race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool '${name}' timed out after ${tool.timeoutMs}ms`)), tool.timeoutMs)
      );

      const result = await Promise.race([tool.handler(args, context), timeoutPromise]);
      const durationMs = Math.round(performance.now() - start);

      logTool.info(`Tool ${name} executed successfully in ${durationMs}ms`);
      auditRepo.log('TOOL', 'info', `Tool ${name} executed`, { toolName: name, durationMs, result });

      eventBus.emit('tool:after_execute', { toolName: name, success: true, durationMs, result });

      return {
        toolName: name,
        success: true,
        durationMs,
        result,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      const errMsg = err?.message || String(err);

      logTool.error(`Tool ${name} failed after ${durationMs}ms: ${errMsg}`);
      auditRepo.log('TOOL', 'error', `Tool ${name} failed: ${errMsg}`, { toolName: name, durationMs, error: errMsg });

      eventBus.emit('tool:error', { toolName: name, error: errMsg, durationMs });

      return {
        toolName: name,
        success: false,
        durationMs,
        error: errMsg,
      };
    }
  }

  private registerCoreTools() {
    // Tier 1: C++ Native Hardware Actuators
    this.register({
      name: 'set_system_volume',
      featureSwitchId: 'system_control',
      description: 'Set system audio volume percentage (0-100) or toggle mute.',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'object',
        properties: {
          percent: { type: 'INTEGER', description: 'Volume percent (0-100)' },
          mute: { type: 'BOOLEAN', description: 'Whether to mute' },
        },
      },
      handler: async (args) => {
        if (args.mute !== undefined) {
          return executeSystemWorkerDirect('audio_actuator', [args.mute ? 'mute' : 'unmute']);
        }
        return executeSystemWorkerDirect('audio_actuator', ['set', String(args.percent ?? 50)]);
      },
    });

    this.register({
      name: 'set_display_brightness',
      featureSwitchId: 'system_control',
      description: 'Set display screen brightness percentage (0-100).',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'object',
        properties: {
          percent: { type: 'INTEGER', description: 'Brightness percent (0-100)' },
        },
        required: ['percent'],
      },
      handler: async (args) => {
        return executeSystemWorkerDirect('brightness_actuator', ['set', String(args.percent)]);
      },
    });

    this.register({
      name: 'get_system_telemetry',
      featureSwitchId: 'system_control',
      description: 'Fetch real-time CPU, RAM, Network, Battery, and Disk ground-truth telemetry.',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return executeSystemWorkerDirect('sys_telemetry', []);
      },
    });

    this.register({
      name: 'inspect_memory',
      featureSwitchId: 'system_control',
      description: 'Run sub-millisecond memory engine diagnosis, SQLite schema inspection, and health status check.',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'STRING', description: 'Inspection mode: "test", "inspect", or "ping"' },
        },
      },
      handler: async (args) => {
        const flag = args.mode === 'inspect' ? '--inspect' : args.mode === 'ping' ? '--ping' : '--test';
        return executeSystemWorkerDirect('memory_tester', [flag]);
      },
    });

    this.register({
      name: 'run_full_system_diagnostics',
      featureSwitchId: 'system_control',
      description: 'Execute an Iron Man Mark-style comprehensive pre-flight diagnostic sweep across ALL subsystems (C++ actuators, SQLite database, memory vault, 5 AI personas, audio DSP chain, skills registry, and cloud connectors). Use whenever the user asks to check if everything is working or requests a system check.',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { suitDiagnosticsEngine } = await import('../core/suit_diagnostics');
        return suitDiagnosticsEngine.runFullPreFlightSweep();
      },
    });

    // Tier 2: Linux Actuators & Shell
    this.register({
      name: 'execute_linux_command',
      featureSwitchId: 'terminal_control',
      description: 'Execute a verified local Linux shell command or tool.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'STRING', description: 'Shell command string to execute' },
        },
        required: ['command'],
      },
      handler: async (args) => {
        return executeLinuxActuator('bash', ['-c', args.command]);
      },
    });

    this.register({
      name: 'launch_application',
      featureSwitchId: 'terminal_control',
      description: 'Launch an installed desktop application on Ubuntu Linux.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          appName: { type: 'STRING', description: 'Name of the application e.g. code, google-chrome, nautilus' },
        },
        required: ['appName'],
      },
      handler: async (args) => {
        return executeLinuxActuator('gtk_launch', [args.appName]);
      },
    });

    this.register({
      name: 'get_vault_index',
      featureSwitchId: 'obsidian_daily_sync',
      description: 'Retrieve the structured Obsidian Memory Vault Map of Content (MOC), domain subfolders, and indexed note counts.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { obsidianSyncBridge } = await import('../utils/obsidian_sync');
        return obsidianSyncBridge.getVaultIndex();
      },
    });

    this.register({
      name: 'read_local_file',
      featureSwitchId: 'file_control',
      description: 'Read the contents of a local file on the host filesystem with smart path and tilde resolution.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'STRING', description: 'Absolute or relative path to read' },
          maxLines: { type: 'INTEGER', description: 'Max lines to read' },
          offset: { type: 'INTEGER', description: 'Line offset' },
        },
        required: ['filePath'],
      },
      handler: async (args) => {
        const { readLocalFile } = await import('../utils/system_controller');
        return readLocalFile(args);
      },
    });

    // Tier 3: Agent Reach — Verified Internet Grounding & Zero-Hallucination Triangulation
    this.register({
      name: 'web_research',
      featureSwitchId: 'research_agent',
      description: 'Perform deep autonomous internet research across 15+ verified channels with Rule of N>=2 fact triangulation, SQLite caching, and cited Markdown reports saved to Obsidian.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'STRING', description: 'The topic or research query.' },
          mode: { type: 'STRING', description: 'Research mode: "fast" (<1.5s voice mode) or "deep" (comprehensive multi-platform).' },
          ttlCategory: { type: 'STRING', description: 'Cache category: "news", "repos", "packages", "docs", "rfc", "academic", "general".' },
          forceRefresh: { type: 'BOOLEAN', description: 'Bypass SQLite cache and fetch fresh live web data.' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { researchEngine } = await import('../research/engine');
        return researchEngine.research({
          query: args.query,
          mode: args.mode || 'deep',
          ttlCategory: args.ttlCategory || 'general',
          forceRefresh: args.forceRefresh,
        });
      },
    });

    this.register({
      name: 'verify_claim',
      featureSwitchId: 'research_agent',
      description: 'Fact-check and verify a specific claim against independent primary sources with confidence score, dispute detection, and verbatim citations.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          claim: { type: 'STRING', description: 'The factual claim, version assertion, or statement to verify.' },
          context: { type: 'STRING', description: 'Optional extra context or domain keywords.' },
        },
        required: ['claim'],
      },
      handler: async (args) => {
        const { researchEngine } = await import('../research/engine');
        return researchEngine.verifyClaim(args.claim, args.context);
      },
    });

    this.register({
      name: 'fast_fact_check',
      featureSwitchId: 'research_agent',
      description: 'Ultra-fast sub-1.5s fact-check for live voice questions with early termination and high-confidence answer extraction.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'STRING', description: 'The factual question or lookup.' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { researchEngine } = await import('../research/engine');
        return researchEngine.fastFactCheck(args.query);
      },
    });

    this.register({
      name: 'web_research_reach',
      description: 'Perform a grounded, multi-source internet research query across verified web channels to obtain real-time facts and prevent hallucination.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'STRING', description: 'The topic, research question, or search query to look up on the live internet.' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { agentReachService } = await import('../services/agent_reach_service');
        return agentReachService.performGroundedResearch(args.query);
      },
    });

    this.register({
      name: 'fetch_verified_webpage',
      description: 'Fetch and read the complete, clean text content of any website or URL with zero ads, scripts, or hallucinations via Jina Reader.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'STRING', description: 'The complete HTTP/HTTPS URL of the web page to read.' },
        },
        required: ['url'],
      },
      handler: async (args) => {
        const { agentReachService } = await import('../services/agent_reach_service');
        return agentReachService.fetchWebPage(args.url);
      },
    });

    this.register({
      name: 'search_internet_grounded',
      description: 'Search the live web for verified search results and factual references with titles, links, and snippets.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'STRING', description: 'Search term or query.' },
          numResults: { type: 'INTEGER', description: 'Number of results to return (default 5).' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { agentReachService } = await import('../services/agent_reach_service');
        return agentReachService.searchWeb(args.query, args.numResults ? Number(args.numResults) : 5);
      },
    });

    this.register({
      name: 'extract_youtube_transcript',
      description: 'Extract ground-truth subtitles and transcripts from any YouTube video URL without hallucinating.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          videoUrl: { type: 'STRING', description: 'YouTube video URL or video ID.' },
        },
        required: ['videoUrl'],
      },
      handler: async (args) => {
        const { agentReachService } = await import('../services/agent_reach_service');
        return agentReachService.fetchYouTubeTranscript(args.videoUrl);
      },
    });

    // Tier 4: LinkedIn Professional & Career Automation
    this.register({
      name: 'linkedin_get_my_profile',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Fetch the authenticated user\'s LinkedIn profile, name, headline, email, and URN.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.getMyProfile();
      },
    });

    this.register({
      name: 'linkedin_create_post',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Publish a new text post or article update to the user\'s LinkedIn feed with custom visibility.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'STRING', description: 'The text content to publish to LinkedIn.' },
          visibility: { type: 'STRING', description: 'Post visibility: "PUBLIC" (default) or "CONNECTIONS".', enum: ['PUBLIC', 'CONNECTIONS'] },
        },
        required: ['text'],
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.createPost(args.text, args.visibility);
      },
    });

    this.register({
      name: 'linkedin_fetch_person',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Fetch and extract comprehensive professional details from any LinkedIn user profile (experience, education, headline, about).',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          profileUrlOrUsername: { type: 'STRING', description: 'LinkedIn profile URL (e.g. "https://www.linkedin.com/in/williamhgates") or username.' },
        },
        required: ['profileUrlOrUsername'],
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.fetchPersonProfile(args.profileUrlOrUsername);
      },
    });

    this.register({
      name: 'linkedin_fetch_company',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Fetch and extract company details from LinkedIn: overview, industry, website, size, and headquarters.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          companyUrlOrName: { type: 'STRING', description: 'LinkedIn company URL or company vanity name (e.g. "google", "microsoft", "openai").' },
        },
        required: ['companyUrlOrName'],
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.fetchCompany(args.companyUrlOrName);
      },
    });

    this.register({
      name: 'linkedin_search_people',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Search professionals, recruiters, and talent on LinkedIn by keyword, position, and location.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          term: { type: 'STRING', description: 'Search term or keyword.' },
          position: { type: 'STRING', description: 'Filter by job position / title (e.g. "Software Engineer", "VP Engineering").' },
          location: { type: 'STRING', description: 'Filter by location (e.g. "San Francisco", "India", "Remote").' },
          limit: { type: 'INTEGER', description: 'Maximum results to return (default 5).' },
        },
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.searchPeople(args);
      },
    });

    this.register({
      name: 'linkedin_search_jobs',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Search open job listings and roles on LinkedIn by keyword and location.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          keywords: { type: 'STRING', description: 'Job title or tech stack (e.g. "Rust Engineer", "AI Researcher").' },
          location: { type: 'STRING', description: 'Job location (e.g. "Remote", "London", "New York").' },
          limit: { type: 'INTEGER', description: 'Number of jobs to return (default 5).' },
        },
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.searchJobs(args);
      },
    });

    this.register({
      name: 'linkedin_send_message',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Send a direct message to a LinkedIn contact.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          personUrl: { type: 'STRING', description: 'LinkedIn profile URL of the recipient.' },
          message: { type: 'STRING', description: 'Message text to send.' },
        },
        required: ['personUrl', 'message'],
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.sendMessage(args.personUrl, args.message);
      },
    });

    this.register({
      name: 'linkedin_send_connection',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Send a LinkedIn connection invitation request with an optional personalized note.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          personUrl: { type: 'STRING', description: 'LinkedIn profile URL of the target contact.' },
          note: { type: 'STRING', description: 'Optional personalized note for the invitation.' },
        },
        required: ['personUrl'],
      },
      handler: async (args) => {
        const { linkedinService } = await import('../services/linkedin_service');
        return linkedinService.sendConnection(args.personUrl, args.note);
      },
    });

    // Tier 4: GitHub Cloud & Developer Automation
    this.register({
      name: 'github_get_my_profile',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Fetch the authenticated GitHub user\'s profile, login, name, email, public repos, and bio.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { githubService } = await import('../services/github_service');
        return githubService.getMyProfile();
      },
    });

    this.register({
      name: 'github_list_my_repos',
      featureSwitchId: 'multi_agent_mesh',
      description: 'List the authenticated user\'s public and private GitHub repositories.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'INTEGER', description: 'Number of repositories to return (default 10).' },
          sort: { type: 'STRING', description: 'Sort by: "updated", "created", or "pushed".' },
        },
      },
      handler: async (args) => {
        const { githubService } = await import('../services/github_service');
        return githubService.listMyRepos(args.limit ? Number(args.limit) : 10, args.sort || 'updated');
      },
    });

    this.register({
      name: 'github_create_issue',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Create a new issue on a GitHub repository.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'STRING', description: 'Repository owner (username or organization).' },
          repo: { type: 'STRING', description: 'Repository name.' },
          title: { type: 'STRING', description: 'Issue title.' },
          body: { type: 'STRING', description: 'Issue description or body markdown.' },
          labels: { type: 'ARRAY', description: 'Optional list of label names.', items: { type: 'STRING' } },
        },
        required: ['owner', 'repo', 'title'],
      },
      handler: async (args) => {
        const { githubService } = await import('../services/github_service');
        return githubService.createIssue(args.owner, args.repo, args.title, args.body, args.labels);
      },
    });

    this.register({
      name: 'github_create_gist',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Create a new public or secret GitHub Gist with code snippets.',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'STRING', description: 'Gist description.' },
          filename: { type: 'STRING', description: 'Name of the primary file.' },
          content: { type: 'STRING', description: 'File content.' },
          isPublic: { type: 'BOOLEAN', description: 'Whether the gist is public (default false).' },
        },
        required: ['filename', 'content'],
      },
      handler: async (args) => {
        const { githubService } = await import('../services/github_service');
        return githubService.createGist(args.description || '', args.filename, args.content, args.isPublic);
      },
    });

    this.register({
      name: 'github_get_repo_details',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Fetch detailed information about any GitHub repository (stars, forks, open issues, language, description).',
      tier: 'tier4_workspace_cloud',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'STRING', description: 'Repository owner.' },
          repo: { type: 'STRING', description: 'Repository name.' },
        },
        required: ['owner', 'repo'],
      },
      handler: async (args) => {
        const { githubService } = await import('../services/github_service');
        return githubService.getRepoDetails(args.owner, args.repo);
      },
    });

    // =============================================================
    // Tier 5: J.A.R.V.I.S. Universal Memory Engine (Rust Axum Engine)
    // =============================================================
    this.register({
      name: 'jarvis_remember',
      featureSwitchId: 'memory_subsystem',
      description: 'Store and persist a high-importance fact, architectural decision, user preference, or pattern in JARVIS universal memory (secret-scanned, written to SQLite WAL + Obsidian Vault + L0 buffer).',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'STRING', description: 'The exact fact, decision, preference, or knowledge text to remember.' },
          title: { type: 'STRING', description: 'Optional short summary title for the memory note.' },
          kind: { type: 'STRING', description: 'Kind of memory: "fact", "decision", "preference", "pattern", "system".' },
          tier: { type: 'STRING', description: 'Memory tier: "persistent", "working", "ephemeral". Default is "working".' },
          importance: { type: 'NUMBER', description: 'Importance score from 0.1 to 1.0 (default 0.7).' },
          tags: { type: 'ARRAY', description: 'Optional tags array for categorization.', items: { type: 'STRING' } },
        },
        required: ['content'],
      },
      handler: async (args) => {
        const { memoryClient } = await import('../memory/client');
        const { memoryContextBuilder } = await import('../memory/context_builder');
        const result = await memoryClient.createNode(args);
        memoryContextBuilder.invalidateCache();
        return result;
      },
    });

    this.register({
      name: 'jarvis_recall',
      featureSwitchId: 'memory_subsystem',
      description: 'Recall and search across past memories, decisions, facts, and conversation history using 4-signal hybrid search (BM25 + Cosine Vector + Graph + Recency) with sub-50ms latency.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'STRING', description: 'The search query or topic to recall.' },
          top_k: { type: 'INTEGER', description: 'Max number of memory nodes to return (default 5).' },
          profile: { type: 'STRING', description: 'Search profile: "balanced", "precision", "recall", "recent".' },
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { memoryClient } = await import('../memory/client');
        return memoryClient.search(args);
      },
    });

    this.register({
      name: 'jarvis_vault_status',
      featureSwitchId: 'memory_subsystem',
      description: 'Retrieve real-time telemetry and status of the JARVIS Memory Engine: total node count, connected edges, unsealed buffers, SQLite WAL metrics, and Obsidian vault index.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { memoryClient } = await import('../memory/client');
        return memoryClient.getStatus();
      },
    });

    this.register({
      name: 'jarvis_tree_drilldown',
      featureSwitchId: 'memory_subsystem',
      description: 'Drill down into hierarchical summary tree notes (L2 -> L1 -> L0) to retrieve full itemized source facts for an aggregated topic.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          root_id: { type: 'STRING', description: 'Root summary node ID to inspect (e.g. tree-L1-xxxx).' },
        },
        required: ['root_id'],
      },
      handler: async (args) => {
        const { memoryClient } = await import('../memory/client');
        return memoryClient.getTreeDrilldown(args.root_id);
      },
    });

    this.register({
      name: 'jarvis_flush_memory',
      featureSwitchId: 'memory_subsystem',
      description: 'Explicitly flush and consolidate pending unsealed memory buffers into structured markdown summary notes.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          stale_threshold_secs: { type: 'INTEGER', description: 'Flush buffers idle for this many seconds (default 0 for immediate flush).' },
        },
      },
      handler: async (args) => {
        const { memoryClient } = await import('../memory/client');
        const { memoryContextBuilder } = await import('../memory/context_builder');
        const result = await memoryClient.flush(args.stale_threshold_secs ?? 0);
        memoryContextBuilder.invalidateCache();
        return result;
      },
    });

    // =============================================================
    // Tier 7: Autonomous Skill Harvester
    // =============================================================
    this.register({
      name: 'jarvis_harvest_skills',
      featureSwitchId: 'multi_agent_mesh',
      description: 'Dynamically harvest and match specialist execution patterns and principles from the 1,440+ skill catalog for any domain or task.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'STRING',
            description: 'Task query, domain keyword, or technical challenge to match skills against.'
          },
          top_k: {
            type: 'INTEGER',
            description: 'Number of top matching skills to return (default: 3).'
          }
        },
        required: ['query'],
      },
      handler: async (args) => {
        const { skillHarvester } = await import('../core/skill_harvester');
        const skills = skillHarvester.harvestSkills(args.query, args.top_k ?? 3);
        return {
          query: args.query,
          matched_skills_count: skills.length,
          skills,
          formatted_prompt_context: skillHarvester.formatSkillsContext(skills)
        };
      },
    });

    // --- Barehands Spatial Air-Board Stage Tools ---
    this.register({
      name: 'stage_present',
      description: 'Present a titled text note center-stage with dynamic spotlighting on the Barehands gesture air-board.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'STRING', description: 'Title of the card to present' },
          body: { type: 'STRING', description: 'Body text content of the note' },
        },
        required: ['title', 'body'],
      },
      handler: async (args) => {
        const { stagePresent } = await import('./stage_tools');
        return await stagePresent(args.title, args.body);
      },
    });

    this.register({
      name: 'stage_add_card',
      description: 'Add an interactive glass card to the Barehands spatial board.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'STRING', description: 'Card title' },
          body: { type: 'STRING', description: 'Card content' },
          orb: { type: 'STRING', description: 'Orb category name (default: notes)' },
        },
        required: ['title', 'body'],
      },
      handler: async (args) => {
        const { stageAddCard } = await import('./stage_tools');
        return await stageAddCard(args.title, args.body, args.orb);
      },
    });

    this.register({
      name: 'stage_add_media',
      description: 'Stage an image, transparent effect prop, or 3D hologram model onto the Barehands air-board.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'STRING', description: 'Filename or relative path inside media/ folder' },
          caption: { type: 'STRING', description: 'Optional caption description' },
        },
        required: ['file'],
      },
      handler: async (args) => {
        const { stageAddMedia } = await import('./stage_tools');
        return await stageAddMedia(args.file, args.caption);
      },
    });

    this.register({
      name: 'stage_clear',
      description: 'Clear all active notes and props from the Barehands air-board stage.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { stageClear } = await import('./stage_tools');
        return await stageClear();
      },
    });

    this.register({
      name: 'stage_get_state',
      description: 'Read what cards and props are currently displayed on the Barehands board.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        const { stageGetState } = await import('./stage_tools');
        return await stageGetState();
      },
    });
  }
}

export const toolRegistry = ToolRegistry.getInstance();

// =============================================================
// Tier 8: Hermes-Grade Autonomous Intelligence Extensions
// =============================================================
import { registerDelegationTool } from './delegation_tool';
import { registerCronTools } from './cron_tool';
import { registerSkillsTools } from './skills_tool';
import { registerPythonTools } from './python_plugin_tool';
import { registerMemorySearchTools } from './memory_search_tool';
import { registerForgeTools } from './forge_tool';
import { registerCodebaseTools } from './codebase_tool';
import { registerKanbanTools } from './kanban_tool';
import { registerBrowserTools } from './browser_cdp_tool';
import { registerTerminalTools } from './terminal_tool';

registerDelegationTool();
registerCronTools();
registerSkillsTools();
registerPythonTools();
registerMemorySearchTools();
registerForgeTools();
registerCodebaseTools();
registerKanbanTools();
registerBrowserTools();
registerTerminalTools();




