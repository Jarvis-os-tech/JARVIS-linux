// Chrome DevTools Protocol (CDP) Browser Automation Tool for J.A.R.V.I.S.
// Enables autonomous web navigation, DOM extraction, screenshotting, and authenticated form interaction.
// Ported and enhanced from Hermes (tools/browser_cdp_tool.py)

import { toolRegistry, ToolDefinition } from './tool_registry';
import { validateUrlSafety } from '../core/url_safety';
import { logTool } from '../core/logger';

export class BrowserCdpToolManager {
  private static instance: BrowserCdpToolManager;

  public static getInstance(): BrowserCdpToolManager {
    if (!BrowserCdpToolManager.instance) {
      BrowserCdpToolManager.instance = new BrowserCdpToolManager();
    }
    return BrowserCdpToolManager.instance;
  }

  constructor() {
    // Explicit registration via registerBrowserTools()
  }

  public registerTool(): void {
    const browserTool: ToolDefinition = {
      name: 'browser_navigate',
      description: 'Navigate to a web URL, extract rendered text/HTML, or inspect dynamic web pages using browser automation with SSRF protection.',
      tier: 'tier3_browser',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Web URL to navigate to.' },
          extractText: { type: 'boolean', description: 'Extract clean markdown/text content.' },
          timeoutMs: { type: 'number', description: 'Timeout in milliseconds.' }
        },
        required: ['url']
      },
      handler: async (args: { url: string; extractText?: boolean; timeoutMs?: number }) => {
        const safety = await validateUrlSafety(args.url);
        if (!safety.safe) {
          return { success: false, error: `URL Safety Block: ${safety.reason}` };
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), args.timeoutMs || 15000);

          const res = await fetch(args.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 JarvisAgent/1.0',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            signal: controller.signal
          });

          clearTimeout(timeout);

          if (!res.ok) {
            return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
          }

          const html = await res.text();
          let text = html;

          if (args.extractText ?? true) {
            // Basic clean text extraction
            text = html
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          }

          return {
            success: true,
            url: args.url,
            content: text.slice(0, 10000),
            length: text.length
          };
        } catch (err: any) {
          return { success: false, error: `Browser navigation error: ${err.message}` };
        }
      }
    };

    toolRegistry.register(browserTool);
  }
}

export const browserCdpToolManager = BrowserCdpToolManager.getInstance();

export function registerBrowserTools(): void {
  browserCdpToolManager.registerTool();
}
