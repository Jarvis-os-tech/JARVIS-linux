// J.A.R.V.I.S. Codebase Intelligence & Graph Memory Tools
// Exposes AST knowledge graph query, symbol search, code reading,
// and safe self-modification tools to J.A.R.V.I.S. and Gemini Live.

import { toolRegistry } from './tool_registry';
import { codebaseMemory } from '../core/codebase_memory';
import { logTool } from '../core/logger';

export function registerCodebaseTools(): void {
  toolRegistry.register({
    name: 'codebase_search_graph',
    description: 'Search the code knowledge graph for functions, classes, routes, and variables. Fast, structured AST search across TypeScript, Python, C++, and Rust.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language or keyword search query (e.g. "audio resampler", "execute_forged_tool", "auth route").',
        },
        name_pattern: {
          type: 'string',
          description: 'Optional regex pattern to match identifier names (e.g. ".*Handler.*", "get_.*").',
        },
        label: {
          type: 'string',
          description: 'Optional node type filter: "Function", "Class", "Interface", "Route", "Variable".',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of results to return (default 15).',
        },
      },
    },
    handler: async (args) => {
      return codebaseMemory.searchGraph(args.query, args.name_pattern, args.label, args.limit || 15);
    },
  });

  toolRegistry.register({
    name: 'codebase_trace_path',
    description: 'Trace execution flow and caller/callee paths for a function or method across the codebase.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        function_name: {
          type: 'string',
          description: 'Exact name of the function to trace (e.g. "executeForgedTool", "bootstrap").',
        },
        direction: {
          type: 'string',
          enum: ['inbound', 'outbound', 'both'],
          description: 'Trace inbound callers, outbound callees, or both.',
        },
        depth: {
          type: 'integer',
          description: 'Max traversal depth in the call graph (default 3).',
        },
      },
      required: ['function_name'],
    },
    handler: async (args) => {
      return codebaseMemory.tracePath(args.function_name, args.direction || 'both', args.depth || 3);
    },
  });

  toolRegistry.register({
    name: 'codebase_get_snippet',
    description: 'Retrieve the exact source code implementation for a function, class, or symbol from the knowledge graph.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        qualified_name: {
          type: 'string',
          description: 'Fully qualified symbol name or function name (e.g. "CapabilityForge.installTool").',
        },
        file_path: {
          type: 'string',
          description: 'Optional relative path to the file containing the symbol.',
        },
      },
      required: ['qualified_name'],
    },
    handler: async (args) => {
      return codebaseMemory.getCodeSnippet(args.qualified_name, args.file_path);
    },
  });

  toolRegistry.register({
    name: 'codebase_get_architecture',
    description: 'Inspect the system-wide architecture overview, subsystem breakdown, component tiers, and node/edge statistics.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        aspects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Aspects to include: ["all"], ["overview"], ["components"], ["dependencies"].',
        },
      },
    },
    handler: async (args) => {
      return codebaseMemory.getArchitecture(args.aspects || ['all']);
    },
  });

  toolRegistry.register({
    name: 'codebase_search_code',
    description: 'Search raw text or regex patterns across files in the codebase with line numbers and snippets.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text string or regex to find.',
        },
        file_pattern: {
          type: 'string',
          description: 'Optional file glob (e.g. "*.ts", "src/server/*", "*.py").',
        },
        limit: {
          type: 'integer',
          description: 'Max matches to return (default 20).',
        },
      },
      required: ['query'],
    },
    handler: async (args) => {
      return codebaseMemory.searchCode(args.query, args.file_pattern, args.limit || 20);
    },
  });

  toolRegistry.register({
    name: 'codebase_view_file',
    description: 'Read source code from a file with optional start and end line ranges.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path to the file in the workspace (e.g. "src/server/ws_handler.ts").',
        },
        start_line: {
          type: 'integer',
          description: '1-indexed starting line number.',
        },
        end_line: {
          type: 'integer',
          description: '1-indexed ending line number.',
        },
      },
      required: ['file_path'],
    },
    handler: async (args) => {
      return codebaseMemory.readFile(args.file_path, args.start_line, args.end_line);
    },
  });

  toolRegistry.register({
    name: 'codebase_edit_file',
    description: 'Safely edit/replace a code snippet inside a workspace file and automatically synchronize the knowledge graph.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'terminal_control',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Relative path to the file in the workspace.',
        },
        target_snippet: {
          type: 'string',
          description: 'Exact text or lines to be replaced.',
        },
        replacement_snippet: {
          type: 'string',
          description: 'New replacement content.',
        },
      },
      required: ['file_path', 'target_snippet', 'replacement_snippet'],
    },
    handler: async (args) => {
      return codebaseMemory.editFile(args.file_path, args.target_snippet, args.replacement_snippet);
    },
  });

  toolRegistry.register({
    name: 'codebase_detect_changes',
    description: 'Detect modified files, uncommitted changes, and their architectural impact on the knowledge graph.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description: 'Optional git ref or tag to compare against (e.g. "HEAD~1").',
        },
      },
    },
    handler: async (args) => {
      return codebaseMemory.detectChanges(args.since);
    },
  });

  toolRegistry.register({
    name: 'codebase_query_graph',
    description: 'Execute a custom Cypher pattern query against the code knowledge graph.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        cypher_query: {
          type: 'string',
          description: 'Cypher query string (e.g. "MATCH (f:Function) WHERE f.name CONTAINS \'audio\' RETURN f.name, f.path LIMIT 10").',
        },
      },
      required: ['cypher_query'],
    },
    handler: async (args) => {
      return codebaseMemory.queryGraph(args.cypher_query);
    },
  });

  logTool.info('Codebase Intelligence & Graph Memory tools registered.');
}
