// OpenClaw Multi-Channel Ambient Gateway Bridge for J.A.R.V.I.S.
// Connects JARVIS to the live OpenClaw Gateway (port 18789) for multi-channel messaging
// (Telegram, Discord, WhatsApp, Slack, Signal, WebChat) and remote node orchestration.

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logOrchestrator, logVoice } from '../core/logger';
import { eventBus } from '../core/event_bus';

export interface OpenClawConfig {
  port: number;
  host: string;
  token?: string;
  enabled: boolean;
}

export class OpenClawBridge {
  private static instance: OpenClawBridge;
  private config: OpenClawConfig;
  private isConnected = false;

  public static getInstance(): OpenClawBridge {
    if (!OpenClawBridge.instance) {
      OpenClawBridge.instance = new OpenClawBridge();
    }
    return OpenClawBridge.instance;
  }

  constructor() {
    this.config = this.loadConfig();
    this.checkHealth();
  }

  private loadConfig(): OpenClawConfig {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    let token = process.env.OPENCLAW_GATEWAY_TOKEN || '';

    if (!token && fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        token = parsed.gateway?.auth?.token || '';
      } catch {
        // config read fallback
      }
    }

    return {
      host: '127.0.0.1',
      port: 18789,
      token,
      enabled: true
    };
  }

  public async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://${this.config.host}:${this.config.port}/health`, { timeout: 3000 }, (res) => {
        if (res.statusCode === 200) {
          this.isConnected = true;
          logOrchestrator.info(`Connected to OpenClaw Multi-Agent Gateway on ${this.config.host}:${this.config.port}`);
          eventBus.emit('openclaw:connected', { host: this.config.host, port: this.config.port });
          resolve(true);
        } else {
          this.isConnected = false;
          resolve(false);
        }
      });

      req.on('error', () => {
        this.isConnected = false;
        resolve(false);
      });
    });
  }

  /**
   * Dispatch a message or prompt through OpenClaw Gateway
   */
  public async dispatchToChannel(channel: string, message: string, recipient?: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const payload = JSON.stringify({
      channel,
      message,
      recipient,
      sender: 'jarvis_os',
      timestamp: Date.now()
    });

    return new Promise((resolve) => {
      const req = http.request(
        {
          host: this.config.host,
          port: this.config.port,
          path: '/api/dispatch',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.token}`
          },
          timeout: 10000
        },
        (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              resolve({ success: res.statusCode === 200, data });
            } catch {
              resolve({ success: res.statusCode === 200, data: body });
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }

  public getStatus(): { connected: boolean; host: string; port: number } {
    return {
      connected: this.isConnected,
      host: this.config.host,
      port: this.config.port
    };
  }
}

export const openClawBridge = OpenClawBridge.getInstance();
