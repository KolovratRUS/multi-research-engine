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

  it('getStats reports one successful request and getRequestCount equals fetchAttempts', async () => {
    const schema = z.object({ hello: z.string() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { hello: 'world' }));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    expect(client.getRequestCount()).toBe(0);
    await client.getJson('/test', {}, schema);
    expect(client.getRequestCount()).toBe(1);
    const stats = client.getStats();
    expect(stats.logicalRequests).toBe(1);
    expect(stats.fetchAttempts).toBe(1);
    expect(stats.successfulResponses).toBe(1);
    expect(stats.httpFailures).toBe(0);
    expect(stats.transportFailures).toBe(0);
    expect(stats.timeouts).toBe(0);
    expect(stats.parseFailures).toBe(0);
    expect(stats.schemaFailures).toBe(0);
    expect(stats.retries).toBe(0);
    expect(stats.byEndpoint['/test']).toEqual({
      logicalRequests: 1,
      fetchAttempts: 1,
      successfulResponses: 1,
      httpFailures: 0,
      transportFailures: 0,
      timeouts: 0,
      parseFailures: 0,
      schemaFailures: 0,
      retries: 0,
    });
  });

  it('retries 500 then success: stats are logicalRequests 1, fetchAttempts 2, httpFailures 1, successfulResponses 1, retries 1', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(makeResponse(500, {}))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await client.getJson('/test', {}, schema);
    expect(client.getRequestCount()).toBe(2);
    const stats = client.getStats();
    expect(stats.logicalRequests).toBe(1);
    expect(stats.fetchAttempts).toBe(2);
    expect(stats.httpFailures).toBe(1);
    expect(stats.successfulResponses).toBe(1);
    expect(stats.retries).toBe(1);
    expect(stats.transportFailures).toBe(0);
    expect(stats.timeouts).toBe(0);
    expect(stats.parseFailures).toBe(0);
    expect(stats.schemaFailures).toBe(0);
  });

  it('retries 500 with retries exhausted: fetchAttempts equals retryAttempts + 1 and no successfulResponses', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(500, {}));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(client.getRequestCount()).toBe(2);
    const stats = client.getStats();
    expect(stats.logicalRequests).toBe(1);
    expect(stats.fetchAttempts).toBe(2);
    expect(stats.httpFailures).toBe(2);
    expect(stats.successfulResponses).toBe(0);
    expect(stats.retries).toBe(1);
  });

  it('HTTP 404 does not retry', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(404, {}));
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 1 });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(client.getRequestCount()).toBe(1);
    const stats = client.getStats();
    expect(stats.logicalRequests).toBe(1);
    expect(stats.fetchAttempts).toBe(1);
    expect(stats.httpFailures).toBe(1);
    expect(stats.retries).toBe(0);
  });

  it('transport rejection then success increments transportFailures, retries, and successfulResponses', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = createMLBHistoricalHttpClient({ fetchImpl, sleep, retryAttempts: 1 });
    await client.getJson('/test', {}, schema);
    expect(client.getRequestCount()).toBe(2);
    const stats = client.getStats();
    expect(stats.transportFailures).toBe(1);
    expect(stats.retries).toBe(1);
    expect(stats.successfulResponses).toBe(1);
  });

  it('timeout increments timeouts and not transportFailures', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('The operation was aborted'));
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 0 });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(client.getRequestCount()).toBe(1);
    const stats = client.getStats();
    expect(stats.timeouts).toBe(1);
    expect(stats.transportFailures).toBe(0);
  });

  it('invalid JSON increments parseFailures once and does not retry', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 1 });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(client.getRequestCount()).toBe(1);
    const stats = client.getStats();
    expect(stats.parseFailures).toBe(1);
    expect(stats.schemaFailures).toBe(0);
    expect(stats.successfulResponses).toBe(0);
    expect(stats.retries).toBe(0);
  });

  it('schema failure increments schemaFailures once and does not retry', async () => {
    const schema = z.object({ ok: z.boolean() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { wrong: true }));
    const client = createMLBHistoricalHttpClient({ fetchImpl, retryAttempts: 1 });
    await expect(client.getJson('/test', {}, schema)).rejects.toThrow(MLBHistoricalHttpError);
    expect(client.getRequestCount()).toBe(1);
    const stats = client.getStats();
    expect(stats.schemaFailures).toBe(1);
    expect(stats.parseFailures).toBe(0);
    expect(stats.successfulResponses).toBe(0);
    expect(stats.retries).toBe(0);
  });

  it('endpoint-family normalization aggregates schedule and feed separately', async () => {
    const schema = z.object({ id: z.number() });
    const feedA = makeResponse(200, { id: 1 });
    const feedB = makeResponse(200, { id: 2 });
    const scheduleWithQuery = makeResponse(200, { id: 3 });
    const fullScheduleUrl = makeResponse(200, { id: 4 });
    const unknownWithQuery = makeResponse(200, { id: 5 });
    const misleading = makeResponse(200, { id: 6 });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(feedA)
      .mockResolvedValueOnce(feedB)
      .mockResolvedValueOnce(scheduleWithQuery)
      .mockResolvedValueOnce(fullScheduleUrl)
      .mockResolvedValueOnce(unknownWithQuery)
      .mockResolvedValueOnce(misleading);
    const client = createMLBHistoricalHttpClient({ fetchImpl });

    await client.getJson('/api/v1.1/game/123/feed/live', {}, schema);
    await client.getJson('/api/v1.1/game/456/feed/live', {}, schema);
    await client.getJson('/api/v1/schedule?startDate=2024-06-01', {}, schema);
    await client.getJson('https://statsapi.mlb.com/api/v1/schedule?sportId=1', {}, schema);
    await client.getJson('https://example.test/custom/path?secret=value', {}, schema);
    await client.getJson('/some/other/feed/live/path', {}, schema);

    const stats = client.getStats();
    expect(stats.byEndpoint['/api/v1.1/game/{gamePk}/feed/live']).toBeDefined();
    expect(stats.byEndpoint['/api/v1/schedule']).toBeDefined();
    expect(stats.byEndpoint['/custom/path']).toBeDefined();
    expect(stats.byEndpoint['/some/other/feed/live/path']).toBeDefined();
    expect(stats.byEndpoint['/api/v1.1/game/{gamePk}/feed/live'].logicalRequests).toBe(2);
    expect(stats.byEndpoint['/api/v1/schedule'].logicalRequests).toBe(2);
    expect(stats.byEndpoint['/custom/path'].logicalRequests).toBe(1);
    expect(stats.byEndpoint['/some/other/feed/live/path'].logicalRequests).toBe(1);
    expect(new Set(Object.keys(stats.byEndpoint))).toEqual(
      new Set([
        '/api/v1.1/game/{gamePk}/feed/live',
        '/api/v1/schedule',
        '/custom/path',
        '/some/other/feed/live/path',
      ]),
    );
  });

  it('getStats returns defensive copy including nested endpoint objects', async () => {
    const schema = z.object({ hello: z.string() });
    const fetchImpl = vi.fn().mockResolvedValue(makeResponse(200, { hello: 'world' }));
    const client = createMLBHistoricalHttpClient({ fetchImpl });
    await client.getJson('/test', {}, schema);
    const firstStats = client.getStats();
    const copy = { ...firstStats, byEndpoint: { ...firstStats.byEndpoint } };
    const nestedEndpointKey = '/test';
    copy.byEndpoint[nestedEndpointKey] = {
      ...copy.byEndpoint[nestedEndpointKey],
      fetchAttempts: 999,
    };
    copy.fetchAttempts = 999;
    const secondStats = client.getStats();
    expect(secondStats.fetchAttempts).toBe(firstStats.fetchAttempts);
    expect(secondStats.byEndpoint[nestedEndpointKey]).toBeDefined();
    expect(secondStats.byEndpoint[nestedEndpointKey].fetchAttempts).toBe(1);
  });

  it('two separately created clients do not share stats', async () => {
    const schema = z.object({ id: z.number() });
    const fetchImplA = vi.fn().mockResolvedValue(makeResponse(200, { id: 1 }));
    const fetchImplB = vi.fn().mockResolvedValue(makeResponse(200, { id: 1 }));
    const clientA = createMLBHistoricalHttpClient({ fetchImpl: fetchImplA });
    const clientB = createMLBHistoricalHttpClient({ fetchImpl: fetchImplB });

    await clientA.getJson('/test', {}, schema);
    expect(clientA.getRequestCount()).toBe(1);
    expect(clientB.getRequestCount()).toBe(0);
    expect(clientA.getStats().fetchAttempts).toBe(1);
    expect(clientB.getStats().fetchAttempts).toBe(0);
  });
});
