import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logMemory } from '../core/logger';

export class EmbeddingProvider {
  private static instance: EmbeddingProvider;
  private ai: GoogleGenAI | null = null;
  private cacheDir: string;
  private readonly TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  public static getInstance(): EmbeddingProvider {
    if (!EmbeddingProvider.instance) {
      EmbeddingProvider.instance = new EmbeddingProvider();
    }
    return EmbeddingProvider.instance;
  }

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'JARVIS-MEMORY', '.cache', 'embeddings');
    this.initCache();
    
    try {
      if (process.env.GEMINI_API_KEY) {
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      } else {
        logMemory.warn('[EmbeddingProvider] GEMINI_API_KEY not set. Embeddings will fail gracefully.');
      }
    } catch (err: any) {
      logMemory.warn(`[EmbeddingProvider] Failed to initialize GoogleGenAI: ${err.message}`);
    }
  }

  private async initCache() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (err) {
      // Ignore
    }
  }

  private getHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  private async readCache(hash: string): Promise<number[] | null> {
    try {
      const filePath = path.join(this.cacheDir, `${hash}.json`);
      const stat = await fs.stat(filePath);
      if (Date.now() - stat.mtimeMs > this.TTL_MS) {
        await fs.unlink(filePath).catch(() => {});
        return null;
      }
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async writeCache(hash: string, embedding: number[]): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, `${hash}.json`);
      await fs.writeFile(filePath, JSON.stringify(embedding));
    } catch (err: any) {
      logMemory.debug(`[EmbeddingProvider] Failed to write cache: ${err.message}`);
    }
  }

  public async embed(text: string): Promise<number[]> {
    if (!text || text.trim() === '') return [];
    
    const hash = this.getHash(text);
    const cached = await this.readCache(hash);
    if (cached) return cached;

    if (!this.ai) {
      logMemory.warn('[EmbeddingProvider] API client not initialized. Returning empty embedding.');
      return [];
    }

    try {
      const response = await this.ai.models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
      });
      const embedding = response.embeddings?.[0]?.values || [];
      if (embedding.length > 0) {
        await this.writeCache(hash, embedding);
      }
      return embedding;
    } catch (err: any) {
      logMemory.warn(`[EmbeddingProvider] API failure: ${err.message}`);
      return [];
    }
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    const textsToEmbed: { index: number, text: string, hash: string }[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || text.trim() === '') {
        results[i] = [];
        continue;
      }

      const hash = this.getHash(text);
      const cached = await this.readCache(hash);
      if (cached) {
        results[i] = cached;
      } else {
        textsToEmbed.push({ index: i, text, hash });
      }
    }

    if (textsToEmbed.length === 0) return results;

    if (!this.ai) {
      logMemory.warn('[EmbeddingProvider] API client not initialized. Returning empty embeddings for remaining.');
      textsToEmbed.forEach(t => results[t.index] = []);
      return results;
    }

    try {
      const promises = textsToEmbed.map(async (t) => {
        try {
          const response = await this.ai!.models.embedContent({
            model: 'gemini-embedding-2',
            contents: t.text,
          });
          const embedding = response.embeddings?.[0]?.values || [];
          if (embedding.length > 0) {
            await this.writeCache(t.hash, embedding);
          }
          results[t.index] = embedding;
        } catch (err: any) {
          logMemory.warn(`[EmbeddingProvider] Batch item API failure: ${err.message}`);
          results[t.index] = [];
        }
      });

      await Promise.all(promises);
    } catch (err: any) {
      logMemory.warn(`[EmbeddingProvider] Batch API failure: ${err.message}`);
      textsToEmbed.forEach(t => {
        if (!results[t.index]) results[t.index] = [];
      });
    }

    return results;
  }
}

export const embeddingProvider = EmbeddingProvider.getInstance();
