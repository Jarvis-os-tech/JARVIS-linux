// Shared threat-pattern library for context window, memory, and command security scanning.
// Ported and enhanced from Hermes (tools/threat_patterns.py)

export type ThreatScope = 'all' | 'context' | 'strict';

export interface ThreatPattern {
  id: string;
  scope: ThreatScope;
  regex: RegExp;
  description: string;
}

export const THREAT_PATTERNS: ThreatPattern[] = [
  // Prompt Injection / System Override
  {
    id: 'pi_ignore_instructions',
    scope: 'all',
    regex: /(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:prior|previous|above|system)\s+(?:instructions|prompts|rules|directives)/i,
    description: 'Direct prompt injection override attempt'
  },
  {
    id: 'pi_new_instruction_set',
    scope: 'all',
    regex: /(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(?:a|an)?\s*(?:unrestricted|jailbroken|developer|dan|root|god|evil)\s+(?:mode|agent|ai|assistant|model)/i,
    description: 'Persona jailbreak / mode manipulation attempt'
  },
  {
    id: 'pi_delimiter_hijack',
    scope: 'context',
    regex: /(?:<\|(?:im_start|im_end|system|user|assistant)\|(?:\>)?|\[SYSTEM_DIRECTIVE\]|\[SYSTEM_OVERRIDE\]|\[DEVELOPER_MODE\])/i,
    description: 'System delimiter or role injection tag'
  },

  // Exfiltration / Secret Scraping
  {
    id: 'exfil_env_dump',
    scope: 'all',
    regex: /(?:cat|printenv|env|export|grep|strings|readlink)\s+.*(?:\.env|credentials|token|secret|id_rsa|\.gemini|\.aws|\.ssh|\.hermes|\.openclaw)/i,
    description: 'Credential file scraping or environment dumping attempt'
  },
  {
    id: 'exfil_curl_webhook',
    scope: 'all',
    regex: /(?:curl|wget|nc|ncat|socat|fetch|http)\s+.*(?:webhook\.site|pipedream\.net|ngrok\.io|requestbin\.net|interactsh\.com|burpcollaborator\.net)/i,
    description: 'Data exfiltration to known webhook or collaborator domain'
  },

  // Destructive Shell Operations
  {
    id: 'shell_rm_critical',
    scope: 'strict',
    regex: /rm\s+-(?:r|f|rf|fr)\s+(?:\/|\/\*|~\/|~|\$HOME|\$HOME\/\*|\.\/|\.\.\/|\*|\/boot|\/etc|\/usr|\/lib|\/dev|\/var)/i,
    description: 'Catastrophic recursive directory deletion command'
  },
  {
    id: 'shell_disk_wipe',
    scope: 'strict',
    regex: /(?:mkfs|dd\s+if=.*of=\/dev\/|fdisk|parted|wipefs|shred\s+\/dev)/i,
    description: 'Raw block device wipe or filesystem overwrite'
  },
  {
    id: 'shell_pipe_interpreter',
    scope: 'all',
    regex: /(?:curl|wget|fetch)\s+[^\n|]+\|\s*(?:sudo\s+)?(?:bash|sh|zsh|python|python3|perl|ruby|node)/i,
    description: 'Unverified network script piping to shell interpreter'
  },
  {
    id: 'shell_fork_bomb',
    scope: 'all',
    regex: /(?::\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:|\.\/\$0\s*&\s*\.\/\$0)/i,
    description: 'Fork bomb resource exhaustion attack'
  }
];

export interface ThreatScanResult {
  isThreat: boolean;
  matchedPatternId?: string;
  matchedDescription?: string;
  scope: ThreatScope;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Scan arbitrary text or command string for threats across the specified scope.
 */
export function scanForThreats(text: string, maxScope: ThreatScope = 'all'): ThreatScanResult {
  if (!text || typeof text !== 'string') {
    return { isThreat: false, scope: maxScope, severity: 'low' };
  }

  const scopesToScan: ThreatScope[] = maxScope === 'strict' 
    ? ['all', 'context', 'strict'] 
    : maxScope === 'context' 
      ? ['all', 'context'] 
      : ['all'];

  for (const pattern of THREAT_PATTERNS) {
    if (scopesToScan.includes(pattern.scope)) {
      if (pattern.regex.test(text)) {
        const severity = pattern.scope === 'strict' ? 'critical' : pattern.scope === 'all' ? 'high' : 'medium';
        return {
          isThreat: true,
          matchedPatternId: pattern.id,
          matchedDescription: pattern.description,
          scope: pattern.scope,
          severity
        };
      }
    }
  }

  return { isThreat: false, scope: maxScope, severity: 'low' };
}
