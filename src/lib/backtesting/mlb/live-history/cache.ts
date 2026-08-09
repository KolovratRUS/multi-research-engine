import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z, type ZodType } from 'zod';
import type { CacheStats, CacheEnvelope, CacheProvenance, MLBHistoricalCacheConfig, MLBHistoricalCache, MLBHistoricalCacheWithProvenance } from './types';
import { CacheEnvelopeSchema, CacheStatsSchema } from './schemas';

const SENSITIVE_PARAM_NAMES = new Set([
  'authorization',
  'cookie',
  'credentials',
  'token',
  'api_key',
  'apikey',
  'secret',
]);

type MemoryCacheStats = z.infer<typeof CacheStatsSchema>;

export function createMLBHistoricalCache(config: MLBHistoricalCacheConfig): MLBHistoricalCacheWithProvenance {
  const stats: MemoryCacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    corruptions: 0,
    versionMismatches: 0,
  };

  return {
    async get(endpoint, params, dataSchema) {
      const result = await readCacheEnvelope(config, endpoint, params, dataSchema, stats);
      return result?.value ?? null;
    },

    async getWithProvenance(endpoint, params, dataSchema) {
      const result = await readCacheEnvelope(config, endpoint, params, dataSchema, stats);
      return result ?? null;
    },

    async set(endpoint, params, data, provenance) {
      const safeParams = normalizeCacheParams(sanitizeCacheParams(params)) as Record<string, unknown>;
      const envelope: CacheEnvelope<unknown> = {
        version: config.version,
        endpoint,
        params: safeParams,
        cachedAt: new Date().toISOString(),
        data,
        provenance,
      };
      CacheEnvelopeSchema(z.unknown()).parse(envelope);
      const key = buildHistoricalCacheKey(endpoint, safeParams);
      const filePath = getCachePath(config, key);
      const tmp = `${filePath}.${process.pid}.tmp`;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(tmp, JSON.stringify(envelope, null, 2), 'utf8');
      await fs.rename(tmp, filePath);
      stats.writes += 1;
    },

    stats(): CacheStats {
      return { ...stats };
    },

    clearStats(): void {
      stats.hits = 0;
      stats.misses = 0;
      stats.writes = 0;
      stats.corruptions = 0;
      stats.versionMismatches = 0;
    },
  };
}

async function readCacheEnvelope<T>(
  config: MLBHistoricalCacheConfig,
  endpoint: string,
  params: Record<string, unknown>,
  dataSchema: ZodType<T>,
  stats: MemoryCacheStats,
): Promise<{ readonly value: T; readonly provenance: CacheProvenance } | null> {
  const safeParams = normalizeCacheParams(sanitizeCacheParams(params)) as Record<string, unknown>;
  const key = buildHistoricalCacheKey(endpoint, safeParams);
  const filePath = getCachePath(config, key);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const envelope = CacheEnvelopeSchema(dataSchema).parse(parsed);
    if (envelope.version !== config.version) {
      stats.versionMismatches += 1;
      stats.misses += 1;
      return null;
    }
    const value = dataSchema.parse(envelope.data as unknown);
    stats.hits += 1;
    return { value, provenance: envelope.provenance };
  } catch (error) {
    await handleCacheMiss(error, filePath, stats);
    return null;
  }
}

export function buildHistoricalCacheKey(
  endpoint: string,
  params: Record<string, unknown>,
): string {
  const payload = JSON.stringify({
    e: endpoint,
    p: normalizeCacheParams(sanitizeCacheParams(params)),
  });
  return `${crypto.createHash('sha256').update(payload).digest('hex')}.json`;
}

function normalizeCacheParams(params: unknown): unknown {
  if (Array.isArray(params)) {
    return params.map((item) => normalizeCacheParams(item));
  }
  if (params && typeof params === 'object') {
    const normalized: Record<string, unknown> = {};
    const keys = Object.keys(params as Record<string, unknown>).sort();
    for (const key of keys) {
      normalized[key] = normalizeCacheParams((params as Record<string, unknown>)[key]);
    }
    return normalized;
  }
  return params;
}

function sanitizeCacheParams(params: unknown): unknown {
  if (Array.isArray(params)) {
    return params.map((item) => sanitizeCacheParams(item));
  }
  if (params && typeof params === 'object') {
    const sanitized: Record<string, unknown> = {};
    const keys = Object.keys(params as Record<string, unknown>);
    for (const key of keys) {
      if (SENSITIVE_PARAM_NAMES.has(key.toLowerCase())) continue;
      sanitized[key] = sanitizeCacheParams((params as Record<string, unknown>)[key]);
    }
    return sanitized;
  }
  return params;
}

function getCachePath(config: MLBHistoricalCacheConfig, key: string): string {
  return path.join(config.root, key);
}

async function handleCacheMiss(error: unknown, filePath: string, stats: MemoryCacheStats): Promise<void> {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') {
    stats.misses += 1;
    return;
  }
  const isJsonParse = error instanceof SyntaxError;
  const isZodError = error instanceof z.ZodError;
  if (isJsonParse || isZodError) {
    await fs.rename(filePath, `${filePath}.corrupt`).catch(() => {});
    stats.corruptions += 1;
    stats.misses += 1;
    return;
  }
  throw error;
}
