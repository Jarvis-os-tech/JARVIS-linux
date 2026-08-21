import { exec } from 'child_process';
import path from 'path';
import http from 'http';
import { logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';

const BAREHANDS_DIR = path.resolve(process.cwd(), 'barehands');
const BAREHANDS_CMD_URL = 'http://127.0.0.1:8794/cmd';

/**
 * Dispatches a JSON command to the Barehands stage server.
 */
export async function sendBarehandsCommand(actionPayload: Record<string, any>): Promise<{ success: boolean; message: string; output?: any }> {
  return new Promise((resolve) => {
    const data = JSON.stringify(actionPayload);
    const req = http.request(BAREHANDS_CMD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 3000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ success: true, message: 'Command dispatched to Barehands stage', output: parsed });
        } catch {
          resolve({ success: true, message: 'Command queued to stage', output: body });
        }
      });
    });

    req.on('error', (_err) => {
      // Fallback to bin/board.sh CLI
      const scriptPath = path.join(BAREHANDS_DIR, 'bin', 'board.sh');
      const escapedPayload = JSON.stringify(actionPayload).replace(/'/g, "'\\''");
      exec(`bash "${scriptPath}" '${escapedPayload}'`, (error, stdout, stderr) => {
        if (error) {
          logTool.warn(`[Stage Tools] Fallback board.sh error: ${error.message}`);
          resolve({ success: false, message: `Failed to dispatch stage command: ${error.message}`, output: stderr });
        } else {
          resolve({ success: true, message: 'Dispatched via board.sh CLI', output: stdout.trim() });
        }
      });
    });

    req.write(data);
    req.end();
  });
}

/**
 * Presents a note card center stage with spotlight and enlarged scale.
 */
export async function stagePresent(title: string, body: string): Promise<{ success: boolean; message: string }> {
  logTool.info(`[Stage] Presenting on stage: ${title}`);
  eventBus.emit('system:alert', { level: 'info', message: `Stage Present: ${title}`, source: 'barehands' });
  const res = await sendBarehandsCommand({ a: 'present', title, body });
  return { success: res.success, message: `Card "${title}" presented center-stage.` };
}

/**
 * Adds an interactive glass card to the Barehands stage.
 */
export async function stageAddCard(title: string, body: string, orb: string = 'notes'): Promise<{ success: boolean; message: string }> {
  logTool.info(`[Stage] Adding card: ${title}`);
  const res = await sendBarehandsCommand({ a: 'add_card', title, body, orb });
  return { success: res.success, message: `Card "${title}" added to stage.` };
}

/**
 * Stages an image, transparent FX, or 3D hologram model.
 */
export async function stageAddMedia(file: string, caption?: string): Promise<{ success: boolean; message: string }> {
  logTool.info(`[Stage] Staging media: ${file}`);
  const res = await sendBarehandsCommand({ a: 'add_img', file, caption: caption || file });
  return { success: res.success, message: `Media "${file}" staged.` };
}

/**
 * Clears all active cards and props from the Barehands stage.
 */
export async function stageClear(): Promise<{ success: boolean; message: string }> {
  logTool.info('[Stage] Clearing air-board stage');
  const res = await sendBarehandsCommand({ a: 'clear' });
  return { success: res.success, message: 'Barehands stage cleared.' };
}

/**
 * Retrieves the live state of cards on the Barehands board.
 */
export async function stageGetState(): Promise<{ success: boolean; state: any }> {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:8794/state', { timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, state: JSON.parse(body) });
        } catch {
          resolve({ success: true, state: body });
        }
      });
    }).on('error', () => {
      resolve({ success: false, state: { cards: [], active: false, error: 'Stage server offline' } });
    });
  });
}
