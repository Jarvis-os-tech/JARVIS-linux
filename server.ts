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
    logServer.info(`J.A.R.V.I.S. Prime Orchestrator Server running on ${url}`);

    if (process.env.NODE_ENV !== 'production') {
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
    server.close(() => {
      logServer.info('HTTP & WebSocket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

bootstrapJarvisServer().catch((err) => {
  logServer.fatal(`Fatal startup error: ${err?.message || err}`);
  process.exit(1);
});
