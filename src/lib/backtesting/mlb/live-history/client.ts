import type { MLBHistoricalHttpClientOptions, MLBHistoricalHttpClient, MLBHistoricalHttpClientStats, MLBHistoricalHttpClientStatsByEndpoint } from './types';
import { MLBHistoricalHttpError } from './types';
import type { MLBHistoricalHttpErrorKind } from './types';
import type { ZodType } from 'zod';

export type { MLBHistoricalHttpClient, MLBHistoricalHttpClientOptions, MLBHistoricalHttpClientStats, MLBHistoricalHttpClientStatsByEndpoint } from './types';
export { MLBHistoricalHttpError } from './types';
export type { MLBHistoricalHttpErrorKind } from './types';

export function createMLBHistoricalHttpClient(
  options: MLBHistoricalHttpClientOptions & { sleep?: (milliseconds: number) => Promise<void> } = {},
): MLBHistoricalHttpClient {
  const rootEndpoint = options.rootEndpoint ?? 'https://statsapi.mlb.com';
  const timeoutMs = options.timeoutMs ?? 10_000;
  const retryAttempts = options.retryAttempts ?? 2;
  const baseBackoffMs = options.baseBackoffMs ?? 500;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  type MemoryEndpointStats = {
    logicalRequests: number;
    fetchAttempts: number;
    successfulResponses: number;
    httpFailures: number;
    transportFailures: number;
    timeouts: number;
    parseFailures: number;
    schemaFailures: number;
    retries: number;
  };

  const memoryStats: {
    logicalRequests: number;
    fetchAttempts: number;
    successfulResponses: number;
    httpFailures: number;
    transportFailures: number;
    timeouts: number;
    parseFailures: number;
    schemaFailures: number;
    retries: number;
    byEndpoint: Record<string, MemoryEndpointStats>;
  } = {
    logicalRequests: 0,
    fetchAttempts: 0,
    successfulResponses: 0,
    httpFailures: 0,
    transportFailures: 0,
    timeouts: 0,
    parseFailures: 0,
    schemaFailures: 0,
    retries: 0,
    byEndpoint: {},
  };

  function getEndpointFamily(endpoint: string): string {
    try {
      const url = new URL(endpoint, 'http://localhost');
      const pathname = url.pathname;
      if (/^\/api\/v1\.1\/game\/[^/]+\/feed\/live$/.test(pathname)) {
        return '/api/v1.1/game/{gamePk}/feed/live';
      }
      if (pathname === '/api/v1/schedule') {
        return '/api/v1/schedule';
      }
      return pathname;
    } catch {
      if (/^\/api\/v1\.1\/game\/[^/]+\/feed\/live$/.test(endpoint)) {
        return '/api/v1.1/game/{gamePk}/feed/live';
      }
      if (endpoint === '/api/v1/schedule') {
        return '/api/v1/schedule';
      }
      return endpoint;
    }
  }

  function ensureEndpoint(family: string): MemoryEndpointStats {
    if (!memoryStats.byEndpoint[family]) {
      memoryStats.byEndpoint[family] = {
        logicalRequests: 0,
        fetchAttempts: 0,
        successfulResponses: 0,
        httpFailures: 0,
        transportFailures: 0,
        timeouts: 0,
        parseFailures: 0,
        schemaFailures: 0,
        retries: 0,
      };
    }
    return memoryStats.byEndpoint[family];
  }

  function incrementEndpoint(family: string, field: keyof MemoryEndpointStats): void {
    const endpoint = ensureEndpoint(family);
    switch (field) {
      case 'logicalRequests':
        endpoint.logicalRequests += 1;
        break;
      case 'fetchAttempts':
        endpoint.fetchAttempts += 1;
        break;
      case 'successfulResponses':
        endpoint.successfulResponses += 1;
        break;
      case 'httpFailures':
        endpoint.httpFailures += 1;
        break;
      case 'transportFailures':
        endpoint.transportFailures += 1;
        break;
      case 'timeouts':
        endpoint.timeouts += 1;
        break;
      case 'parseFailures':
        endpoint.parseFailures += 1;
        break;
      case 'schemaFailures':
        endpoint.schemaFailures += 1;
        break;
      case 'retries':
        endpoint.retries += 1;
        break;
    }
  }

  return {
    async getJson(endpoint, params, schema) {
      const family = getEndpointFamily(endpoint);
      memoryStats.logicalRequests += 1;
      incrementEndpoint(family, 'logicalRequests');

      const url = buildUrl(rootEndpoint, endpoint, params);

      for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
        if (attempt > 0) {
          memoryStats.retries += 1;
          incrementEndpoint(family, 'retries');
        }
        memoryStats.fetchAttempts += 1;
        incrementEndpoint(family, 'fetchAttempts');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetchImpl(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
            memoryStats.httpFailures += 1;
            incrementEndpoint(family, 'httpFailures');
            const httpError = new MLBHistoricalHttpError({
              endpoint,
              status: response.status,
              attempts: attempt + 1,
              kind: 'HTTP',
              message: `HTTP ${response.status}: ${response.statusText}`,
            });
            if (shouldRetry(httpError, attempt, retryAttempts)) {
              await sleep(baseBackoffMs * 2 ** attempt);
              continue;
            }
            throw httpError;
          }

          let raw: unknown;
          try {
            raw = await response.json();
          } catch (jsonError) {
            memoryStats.parseFailures += 1;
            incrementEndpoint(family, 'parseFailures');
            const parseError = new MLBHistoricalHttpError({
              endpoint,
              status: response.status,
              attempts: attempt + 1,
              kind: 'VALIDATION',
              cause: jsonError,
              message: `JSON parse failed for ${endpoint}`,
            });
            if (shouldRetry(parseError, attempt, retryAttempts)) {
              await sleep(baseBackoffMs * 2 ** attempt);
              continue;
            }
            throw parseError;
          }

          try {
            const parsed = schema.parse(raw);
            memoryStats.successfulResponses += 1;
            incrementEndpoint(family, 'successfulResponses');
            return parsed;
          } catch (validationError) {
            memoryStats.schemaFailures += 1;
            incrementEndpoint(family, 'schemaFailures');
            const schemaError = new MLBHistoricalHttpError({
              endpoint,
              status: response.status,
              attempts: attempt + 1,
              kind: 'VALIDATION',
              cause: validationError,
              message: `Zod validation failed for ${endpoint}`,
            });
            if (shouldRetry(schemaError, attempt, retryAttempts)) {
              await sleep(baseBackoffMs * 2 ** attempt);
              continue;
            }
            throw schemaError;
          }
        } catch (error) {
          clearTimeout(timeoutId);
          const httpError = toHttpError(error, endpoint, attempt);
          if (httpError.kind === 'NETWORK') {
            memoryStats.transportFailures += 1;
            incrementEndpoint(family, 'transportFailures');
          } else if (httpError.kind === 'TIMEOUT') {
            memoryStats.timeouts += 1;
            incrementEndpoint(family, 'timeouts');
          }
          if (shouldRetry(httpError, attempt, retryAttempts)) {
            await sleep(baseBackoffMs * 2 ** attempt);
            continue;
          }
          throw httpError;
        }
      }

      throw new MLBHistoricalHttpError({
        endpoint,
        status: null,
        attempts: retryAttempts + 1,
        kind: 'NETWORK',
        message: `Exhausted retries for ${endpoint}`,
      });
    },

    getRequestCount() {
      return memoryStats.fetchAttempts;
    },

    getStats(): MLBHistoricalHttpClientStats {
      const byEndpoint = Object.fromEntries(
        Object.entries(memoryStats.byEndpoint).map(
          ([key, value]) => [key, { ...value }],
        ),
      );
      return {
        logicalRequests: memoryStats.logicalRequests,
        fetchAttempts: memoryStats.fetchAttempts,
        successfulResponses: memoryStats.successfulResponses,
        httpFailures: memoryStats.httpFailures,
        transportFailures: memoryStats.transportFailures,
        timeouts: memoryStats.timeouts,
        parseFailures: memoryStats.parseFailures,
        schemaFailures: memoryStats.schemaFailures,
        retries: memoryStats.retries,
        byEndpoint,
      };
    },
  };
}

function buildUrl(root: string, endpoint: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(endpoint, root);
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== false && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function shouldRetry(error: MLBHistoricalHttpError, attempt: number, retryAttempts: number): boolean {
  if (attempt >= retryAttempts) return false;
  if (error.kind === 'VALIDATION') return false;
  if (error.kind === 'HTTP') {
    return error.status === 429 || (error.status !== null && error.status >= 500);
  }
  return error.kind === 'NETWORK' || error.kind === 'TIMEOUT';
}

function toHttpError(error: unknown, endpoint: string, attempt: number): MLBHistoricalHttpError {
  if (error instanceof MLBHistoricalHttpError) {
    return error;
  }

  let kind: MLBHistoricalHttpErrorKind = 'HTTP';
  let status: number | null = null;

  if (error instanceof Error) {
    if (error.name === 'AbortError' || /timeout|abort/i.test(error.message)) {
      kind = 'TIMEOUT';
    } else if (/network|fetch|econnreset|enotfound/i.test(error.message)) {
      kind = 'NETWORK';
    }
    const possibleStatus = (error as { status?: number }).status;
    if (typeof possibleStatus === 'number') {
      status = possibleStatus;
    }
  }

  return new MLBHistoricalHttpError({
    endpoint,
    status,
    attempts: attempt + 1,
    kind,
    cause: error,
    message: error instanceof Error ? error.message : String(error),
  });
}
