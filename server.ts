import express from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { primeOrchestrator } from './src/core/prime_orchestrator';
import { logServer } from './src/core/logger';
import { createApiRouter } from './src/server/routes';
import { attachWebSocketServer } from './src/server/ws_handler';

dotenv.config();

// Sanitize console usage early in startup: route server console.* through the pino logger
import './src/core/console_sanitizer';

// Global Crash Prevention & Resilience Guard
process.on('uncaughtException', (err: Error) => {
  logServer.error(`[CRASH PREVENTED] Uncaught Exception: ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason: any) => {
  logServer.error(`[CRASH PREVENTED] Unhandled Rejection: ${reason?.message || reason}`, {
    stack: reason?.stack,
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

async function bootstrapJarvisServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const server = http.createServer(app);

  // 1. Initialize Central Prime Orchestrator Core (Event Bus, SQLite, Watchdog)
  await primeOrchestrator.bootstrap();

  // 2. Mount Decoupled Modular REST API Router
  app.use('/api', createApiRouter());

  // 2.1 Mount Spatial Stage and AI-Visualizer Suite
  app.use('/barehands', express.static(path.join(process.cwd(), 'barehands')));
  app.use('/visualizer', express.static(path.join(process.cwd(), 'ai-visualizer')));

  // 2.2 Direct Visualizer State & Config Bus Endpoints
  app.get('/state', async (_req, res) => {
    const { getCurrentVoiceStatePayload } = await import('./src/utils/voice_signals');
    res.json(getCurrentVoiceStatePayload());
  });

  app.get('/config', (_req, res) => {
    res.json({
      name: "JARVIS",
      badge: "MK-VII",
      default_face: "radial",
      thinking_sound: false,
      faces: [{ id: "radial", name: "Radial", file: "faces/radial/index.html" }]
    });
  });

  // 3. Attach Gemini Live & Realtime WebSocket Transport
  attachWebSocketServer(server);

  // 4. Mount Vite Dev Server or Production Static Files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 5. Start Server Listener
  server.listen(PORT, HOST, async () => {
    const url = `http://${HOST}:${PORT}`;
    logServer.info(`J.A.R.V.I.S. OS Prime Orchestrator Server running on ${url}`);

    const isTauriDesktop = !!(process.env.IS_TAURI || process.env.JARVIS_DESKTOP || process.env.TAURI_ENV_PLATFORM || process.env.JARVIS_NO_BROWSER);
    if (process.env.NODE_ENV !== 'production' && !isTauriDesktop) {
      try {
        const { exec } = await import('child_process');
        const startCommand =
          process.platform === 'darwin'
            ? `open ${url}`
            : process.platform === 'win32'
            ? `start ${url}`
            : `xdg-open ${url}`;
        exec(startCommand);
      } catch {
        // ignore open browser failure
      }
    }
  });

  // Graceful Shutdown
  const handleShutdown = async (signal: string) => {
    logServer.warn(`Received ${signal}. Shutting down J.A.R.V.I.S. Core...`);

    // 1. Gracefully tear down all ephemeral resources and stop watchdog
    await primeOrchestrator.shutdown();

    // 2. Close HTTP & WebSocket server
    server.close(() => {
      logServer.info('HTTP & WebSocket server closed.');
      process.exit(0);
    });

    // Force exit after 5s if graceful close hangs
    setTimeout(() => {
      logServer.warn('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

// Global Process Resilience & Anti-Crash Guards
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logServer.error(`[Process] Unhandled Rejection intercepted: ${reason?.stack || reason?.message || reason}`);
});

process.on('uncaughtException', (err: Error) => {
  logServer.error(`[Process] Uncaught Exception intercepted: ${err?.stack || err?.message || err}`);
});

bootstrapJarvisServer().catch((err) => {
  logServer.fatal(`Fatal startup error: ${err?.message || err}`);
  process.exit(1);
});
