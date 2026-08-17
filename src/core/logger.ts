export type SubsystemTag =
  | 'ORCHESTRATOR'
  | 'ACTUATOR'
  | 'VOICE'
  | 'VISION'
  | 'TOOL'
  | 'LIFECYCLE'
  | 'DB'
  | 'TASK_QUEUE'
  | 'WATCHDOG'
  | 'SWITCH_MANAGER'
  | 'OBSIDIAN'
  | 'SERVER';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

import pino from 'pino';
import fs from 'fs';
import path from 'path';

const logDir = path.join(process.cwd(), 'data', 'logs');
fs.mkdirSync(logDir, { recursive: true });

const pinoLogger = pino(
  pino.destination({ dest: path.join(logDir, 'jarvis.log'), append: true })
);

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  red: '\x1b[31m',
  boldRed: '\x1b[1;31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41;37m',
};

const SUBSYSTEM_COLORS: Record<SubsystemTag, string> = {
  ORCHESTRATOR: ANSI.cyan,
  ACTUATOR: ANSI.green,
  VOICE: ANSI.magenta,
  VISION: ANSI.blue,
  TOOL: ANSI.yellow,
  LIFECYCLE: ANSI.dim,
  DB: ANSI.cyan,
  TASK_QUEUE: ANSI.blue,
  WATCHDOG: ANSI.yellow,
  SWITCH_MANAGER: ANSI.dim,
  OBSIDIAN: ANSI.magenta,
  SERVER: ANSI.green,
};

function formatTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export interface SubsystemLogger {
  trace: (msg: string, meta?: any) => void;
  debug: (msg: string, meta?: any) => void;
  info: (msg: string, meta?: any) => void;
  warn: (msg: string, meta?: any) => void;
  error: (msg: string, meta?: any) => void;
  fatal: (msg: string, meta?: any) => void;
}

export function createSubsystemLogger(subsystem: SubsystemTag): SubsystemLogger {
  const color = SUBSYSTEM_COLORS[subsystem] || ANSI.cyan;

  const log = (level: LogLevel, msg: string, meta?: any) => {
    // Write to pino JSON stream
    const pinoLogData: any = { subsystem, msg };
    if (meta !== undefined) {
      pinoLogData.meta = meta;
    }
    pinoLogger[level](pinoLogData);

    const timeStr = `${ANSI.dim}${formatTime()}${ANSI.reset}`;
    const badge = `${color}[${subsystem}]${ANSI.reset}`;

    if (level === 'error' || level === 'fatal') {
      const divider = `${ANSI.boldRed}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI.reset}`;
      console.error(`\n${divider}`);
      console.error(`${ANSI.boldRed}error : ${ANSI.bold}[${subsystem}] ${msg}${ANSI.reset}`);
      if (meta) {
        if (meta instanceof Error) {
          console.error(`${ANSI.red}${meta.stack || meta.message}${ANSI.reset}`);
        } else {
          try {
            console.error(`${ANSI.red}Details: ${JSON.stringify(meta, null, 2)}${ANSI.reset}`);
          } catch {
            console.error(`${ANSI.red}Details: ${String(meta)}${ANSI.reset}`);
          }
        }
      }
      console.error(`${divider}\n`);
      return;
    }

    if (level === 'warn') {
      console.warn(`${timeStr} ${ANSI.yellow}⚠ [WARN]${ANSI.reset} ${badge} ${ANSI.yellow}${msg}${ANSI.reset}`);
      if (meta) console.warn(`${ANSI.dim}  ${JSON.stringify(meta)}${ANSI.reset}`);
      return;
    }

    if (level === 'debug' || level === 'trace') {
      if (process.env.DEBUG || process.env.NODE_ENV !== 'production') {
        console.log(`${timeStr} ${ANSI.dim}[DEBUG] [${subsystem}] ${msg}${ANSI.reset}`);
      }
      return;
    }

    // Default info
    let icon = '•';
    if (subsystem === 'TOOL') icon = '⚡';
    else if (subsystem === 'VOICE') icon = '🎙';
    else if (subsystem === 'DB') icon = '💾';
    else if (subsystem === 'ORCHESTRATOR') icon = '🧠';
    else if (subsystem === 'SERVER') icon = '🌐';
    else if (subsystem === 'OBSIDIAN') icon = '📓';

    console.log(`${timeStr} ${badge} ${icon} ${msg}`);
    if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
      console.log(`${ANSI.dim}  ↳ ${JSON.stringify(meta)}${ANSI.reset}`);
    }
  };

  return {
    trace: (msg: string, meta?: any) => log('trace', msg, meta),
    debug: (msg: string, meta?: any) => log('debug', msg, meta),
    info: (msg: string, meta?: any) => log('info', msg, meta),
    warn: (msg: string, meta?: any) => log('warn', msg, meta),
    error: (msg: string, meta?: any) => log('error', msg, meta),
    fatal: (msg: string, meta?: any) => log('fatal', msg, meta),
  };
}

// Pre-instantiated core subsystem loggers
export const logOrchestrator = createSubsystemLogger('ORCHESTRATOR');
export const logActuator = createSubsystemLogger('ACTUATOR');
export const logVoice = createSubsystemLogger('VOICE');
export const logVision = createSubsystemLogger('VISION');
export const logTool = createSubsystemLogger('TOOL');
export const logLifecycle = createSubsystemLogger('LIFECYCLE');
export const logDb = createSubsystemLogger('DB');
export const logTaskQueue = createSubsystemLogger('TASK_QUEUE');
export const logWatchdog = createSubsystemLogger('WATCHDOG');
export const logSwitch = createSubsystemLogger('SWITCH_MANAGER');
export const logObsidian = createSubsystemLogger('OBSIDIAN');
export const logServer = createSubsystemLogger('SERVER');
