import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createMLBHistoricalHttpClient, MLBHistoricalHttpError } from '@/lib/backtesting/mlb/live-history/client';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createMLBHistoricalHttpClient', () => {
  it('validates a good payload', async () => {
    const schema = z.object({ hello: z.string() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { hello: 'world' }));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    const result = await client.getJson('/test', {}, schema);
    expect(result).toEqual({ hello: 'world' });
    expect(client.getRequestCount()).toBe(1);
  });

  it('retries 429 then succeeds', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse(429, { error: 'rate limit' }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    const result = await client.getJson('/test', {}, schema);
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('retries 500 then succeeds', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse(500, {}))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await client.getJson('/test', {}, schema);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('retries network error then succeeds', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await client.getJson('/test', {}, schema);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('retries timeout then succeeds', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('The operation was aborted'))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await client.getJson('/test', {}, schema);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry 404', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(404, {}));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry Zod validation failure', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { wrong: true }));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('final attempt does not sleep afterward', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network failure'));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('produces typed error fields', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(500, {}));
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 0 });
    try {
      await client.getJson('/test', {}, schema);
      throw new Error('should not reach');
    } catch (error) {
      if (error instanceof MLBHistoricalHttpError) {
        expect(error.endpoint).toBe('/test');
        expect(error.status).toBe(500);
        expect(error.attempts).toBe(1);
        expect(error.kind).toBe('HTTP');
      } else {
        throw new Error('Expected MLBHistoricalHttpError');
      }
    }
  });
});
