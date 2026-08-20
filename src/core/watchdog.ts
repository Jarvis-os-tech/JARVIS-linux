import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { logWatchdog } from './logger';
import { eventBus } from './event_bus';
import { jarvisDb } from '../db/db';
import { lifecycleManager } from './lifecycle_manager';

export interface WatchdogHealthReport {
  timestamp: number;
  status: 'healthy' | 'degraded' | 'critical';
  sqliteLatencyMs: number;
  freeMemMb: number;
  totalMemMb: number;
  activeEphemeralResources: number;
  issues: string[];
  cpuTempCelsius: number | null;
}

export class SystemWatchdog {
  private static instance: SystemWatchdog;
  private timer: NodeJS.Timeout | null = null;
  private intervalMs = 10000;
  private lastReport: WatchdogHealthReport | null = null;

  public static getInstance(): SystemWatchdog {
    if (!SystemWatchdog.instance) {
      SystemWatchdog.instance = new SystemWatchdog();
    }
    return SystemWatchdog.instance;
  }

  constructor() {
    this.start();
    logWatchdog.info('Self-Healing Watchdog active (10s continuous probe cycle).');
  }

  public start(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.probe(), this.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async probe(): Promise<WatchdogHealthReport> {
    const issues: string[] = [];
    const startDb = performance.now();

    // 1. SQLite Health Check
    try {
      jarvisDb.db.prepare('SELECT 1').get();
    } catch (err: any) {
      issues.push(`SQLite query failure: ${err?.message}`);
    }
    const sqliteLatencyMs = Math.round(performance.now() - startDb);
    if (sqliteLatencyMs > 50) {
      issues.push(`High SQLite latency: ${sqliteLatencyMs}ms`);
    }

    // 2. Memory Check via /proc/meminfo
    let freeMemMb = 0;
    let totalMemMb = 0;
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const totalMatch = meminfo.match(/MemTotal:\s+(\d+)\s+kB/);
      const availMatch = meminfo.match(/MemAvailable:\s+(\d+)\s+kB/);
      if (totalMatch && availMatch) {
        totalMemMb = Math.round(parseInt(totalMatch[1], 10) / 1024);
        freeMemMb = Math.round(parseInt(availMatch[1], 10) / 1024);
      }
    } catch {
      // fallback if not linux
    }

    if (freeMemMb > 0 && freeMemMb < 500) {
      issues.push(`Low available memory: ${freeMemMb}MB free. Triggering emergency lifecycle sweeper.`);
      logWatchdog.warn(`Low memory detected (${freeMemMb}MB). Triggering emergency resource teardown.`);
      await lifecycleManager.teardownAll('LOW_MEMORY_AUTORECOVERY');
    }

    // 3. Native Workers Check
    const workersDir = path.join(process.cwd(), 'workers_cpp', 'bin');
    if (!fs.existsSync(workersDir)) {
      issues.push('workers_cpp/bin directory missing');
    }

    // 4. Sound Server Check (Supports PipeWire, WirePlumber, PulseAudio, and ALSA)
    try {
      if (process.platform === 'linux') {
        child_process.execSync(
          'wpctl status >/dev/null 2>&1 || pw-cli info 0 >/dev/null 2>&1 || systemctl --user is-active --quiet pipewire.service || pactl info >/dev/null 2>&1',
          { timeout: 3000 }
        );
      }
    } catch (err: any) {
      issues.push(`Sound server check degraded: ${err?.message || 'Audio subsystem status check timeout'}`);
    }

    // 5. CPU Temperature Check
    let cpuTempCelsius: number | null = null;
    try {
      const tempStr = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
      const tempMilliDegrees = parseInt(tempStr.trim(), 10);
      if (!isNaN(tempMilliDegrees)) {
        cpuTempCelsius = tempMilliDegrees / 1000;
        if (cpuTempCelsius > 90) {
          issues.push(`Critical CPU temperature: ${cpuTempCelsius.toFixed(1)}°C`);
        } else if (cpuTempCelsius > 80) {
          issues.push(`Warning CPU temperature: ${cpuTempCelsius.toFixed(1)}°C`);
        }
      }
    } catch {
      // fallback
    }

    const ephemeralStatus = lifecycleManager.getStatus();
    const status: WatchdogHealthReport['status'] =
      issues.length === 0 ? 'healthy' : issues.some((i) => i.includes('failure') || i.includes('Low available')) ? 'critical' : 'degraded';

    const report: WatchdogHealthReport = {
      timestamp: Date.now(),
      status,
      sqliteLatencyMs,
      freeMemMb,
      totalMemMb,
      activeEphemeralResources: ephemeralStatus.activeCount,
      issues,
      cpuTempCelsius,
    };

    this.lastReport = report;

    if (status !== 'healthy') {
      logWatchdog.warn(`Watchdog status: ${status}`, { issues });
      eventBus.emit('system:alert', {
        level: status === 'critical' ? 'error' : 'warn',
        message: issues.join('; '),
        source: 'WATCHDOG',
      });
    }

    eventBus.emit('watchdog:probe', report);

    return report;
  }

  public getLatestReport(): WatchdogHealthReport | null {
    return this.lastReport;
  }
}

export const watchdog = SystemWatchdog.getInstance();
