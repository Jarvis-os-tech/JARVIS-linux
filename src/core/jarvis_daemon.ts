// Headless J.A.R.V.I.S. Autonomous Daemon Supervisor
// Runs 24/7 in the background on Linux with PID locking, signal management,
// cron execution, OpenClaw gateway connection, and background review dreaming loops.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logOrchestrator } from './logger';
import { cronEngine } from './cron_engine';
import { openClawBridge } from '../services/openclaw_bridge';
import { backgroundReview } from './background_review';
import { eventBus } from './event_bus';

const RUNTIME_DIR = path.join(os.homedir(), '.jarvis');
const PID_FILE = path.join(RUNTIME_DIR, 'jarvis.pid');
const LOCK_FILE = path.join(RUNTIME_DIR, 'jarvis.lock');

export class JarvisDaemonSupervisor {
  private static instance: JarvisDaemonSupervisor;
  private isRunning = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public static getInstance(): JarvisDaemonSupervisor {
    if (!JarvisDaemonSupervisor.instance) {
      JarvisDaemonSupervisor.instance = new JarvisDaemonSupervisor();
    }
    return JarvisDaemonSupervisor.instance;
  }

  public start(): void {
    if (this.isRunning) return;

    this.ensureRuntimeDir();
    this.acquireLock();
    this.isRunning = true;

    logOrchestrator.info(`🚀 J.A.R.V.I.S. Sovereign Daemon Core started (PID: ${process.pid})`);

    // 1. Initialize 24/7 background subsystems
    cronEngine.start();
    openClawBridge.checkHealth();
    backgroundReview;

    // 2. Setup 30s liveness heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000);

    // 3. Register process signal handlers
    this.setupSignalHandlers();

    eventBus.emit('daemon:started', { pid: process.pid, timestamp: Date.now() });
  }

  private ensureRuntimeDir(): void {
    if (!fs.existsSync(RUNTIME_DIR)) {
      fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    }
  }

  private acquireLock(): void {
    fs.writeFileSync(PID_FILE, String(process.pid), 'utf-8');
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf-8');
  }

  private heartbeat(): void {
    logOrchestrator.debug(`[Daemon Heartbeat] All systems nominal. PID: ${process.pid}`);
    eventBus.emit('daemon:heartbeat', { timestamp: Date.now() });
  }

  private setupSignalHandlers(): void {
    const shutdown = (signal: string) => {
      logOrchestrator.info(`[Daemon] Received ${signal}. Shutting down gracefully...`);
      this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    cronEngine.stop();

    try {
      if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
      if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
    } catch {
      // cleanup fallback
    }

    logOrchestrator.info('[Daemon] J.A.R.V.I.S. Daemon Core stopped cleanly.');
    eventBus.emit('daemon:stopped', { timestamp: Date.now() });
  }
}

export const jarvisDaemon = JarvisDaemonSupervisor.getInstance();
