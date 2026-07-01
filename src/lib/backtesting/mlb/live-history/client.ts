import type { MLBHistoricalHttpClientOptions, MLBHistoricalHttpClient } from './types';
import { MLBHistoricalHttpError } from './types';
import type { MLBHistoricalHttpErrorKind } from './types';
import type { ZodType } from 'zod';

export type { MLBHistoricalHttpClient, MLBHistoricalHttpClientOptions } from './types';
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

  let requestCount = 0;

  return {
    async getJson(endpoint, params, schema) {
      const url = buildUrl(rootEndpoint, endpoint, params);

      for (let attempt = 0; attempt <= retryAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        requestCount += 1;

        try {
          const response = await fetchImpl(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
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

          const raw = (await response.json()) as unknown;
          try {
            return schema.parse(raw);
          } catch (validationError) {
            const validationErrorTyped = new MLBHistoricalHttpError({
              endpoint,
              status: null,
              attempts: attempt + 1,
              kind: 'VALIDATION',
              cause: validationError,
              message: `Zod validation failed for ${endpoint}`,
            });
            throw validationErrorTyped;
          }
        } catch (error) {
          clearTimeout(timeoutId);
          const httpError = toHttpError(error, endpoint, attempt);
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
      return requestCount;
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
