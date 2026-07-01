import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { createMLBHistoricalCache, buildHistoricalCacheKey } from '@/lib/backtesting/mlb/live-history/cache';

describe('buildHistoricalCacheKey', () => {
  it('equivalent parameter order produces the same key', () => {
    const keyA = buildHistoricalCacheKey('/ep', { a: 1, b: 2 });
    const keyB = buildHistoricalCacheKey('/ep', { b: 2, a: 1 });
    expect(keyA).toBe(keyB);
  });

  it('different endpoints produce different keys', () => {
    const keyA = buildHistoricalCacheKey('/ep-a', { id: 1 });
    const keyB = buildHistoricalCacheKey('/ep-b', { id: 1 });
    expect(keyA).not.toBe(keyB);
  });
});

describe('createMLBHistoricalCache', () => {
  it('hits and misses preserve stats correctly', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const schema = z.object({ data: z.string() });
    const result = await cache.get('/ep', { id: 1 }, schema);
    expect(result).toBeNull();
    expect(cache.stats()).toEqual({ hits: 0, misses: 1, writes: 0, corruptions: 0, versionMismatches: 0 });
    await cache.set('/ep', { id: 1 }, { data: 'hello' }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    expect(cache.stats()).toEqual({ hits: 0, misses: 1, writes: 1, corruptions: 0, versionMismatches: 0 });
    const hit = await cache.get('/ep', { id: 1 }, schema);
    expect(hit).toEqual({ data: 'hello' });
    expect(cache.stats()).toEqual({ hits: 1, misses: 1, writes: 1, corruptions: 0, versionMismatches: 0 });
  });

  it('version mismatch increments versionMismatches and misses', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cacheV1 = createMLBHistoricalCache({ root, version: 'v1' });
    const cacheV2 = createMLBHistoricalCache({ root, version: 'v2' });
    const schema = z.object({ data: z.string() });
    await cacheV1.set('/ep', {}, { data: 'hello' }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    const result = await cacheV2.get('/ep', {}, schema);
    expect(result).toBeNull();
    expect(cacheV2.stats()).toEqual({ hits: 0, misses: 1, writes: 0, corruptions: 0, versionMismatches: 1 });
  });

  it('corrupt JSON increments corruptions and misses', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const schema = z.object({ data: z.string() });
    await cache.set('/ep', {}, { data: 'hello' }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    const fileName = (await fs.readdir(root))[0];
    await fs.writeFile(path.join(root, fileName), 'not json', 'utf8');
    const result = await cache.get('/ep', {}, schema);
    expect(result).toBeNull();
    expect(cache.stats()).toEqual({ hits: 0, misses: 1, writes: 1, corruptions: 1, versionMismatches: 0 });
  });

  it('invalid envelope increments corruptions and misses', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const schema = z.object({ data: z.string() });
    await cache.set('/ep', {}, { data: 'hello' }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    const fileName = (await fs.readdir(root))[0];
    await fs.writeFile(path.join(root, fileName), JSON.stringify({ bad: true }), 'utf8');
    const result = await cache.get('/ep', {}, schema);
    expect(result).toBeNull();
    expect(cache.stats()).toEqual({ hits: 0, misses: 1, writes: 1, corruptions: 1, versionMismatches: 0 });
  });

  it('invalid cached data increments corruptions and misses', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    await cache.set('/ep', {}, { data: 123 }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    const schema = z.object({ data: z.string() });
    const result = await cache.get('/ep', {}, schema);
    expect(result).toBeNull();
    expect(cache.stats()).toEqual({ hits: 0, misses: 1, writes: 1, corruptions: 1, versionMismatches: 0 });
  });

  it('corrupt file is renamed to .corrupt', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    await cache.set('/ep', {}, { data: 'hello' }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    const fileName = (await fs.readdir(root))[0];
    await fs.writeFile(path.join(root, fileName), 'not json', 'utf8');
    await cache.get('/ep', {}, z.object({ data: z.string() }));
    const files = await fs.readdir(root);
    expect(files.some((f) => f.endsWith('.corrupt'))).toBe(true);
  });

  it('stats are cumulative and clearStats works', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    const schema = z.object({ data: z.string() });
    await cache.get('/ep', {}, schema);
    await cache.get('/ep', {}, schema);
    expect(cache.stats().misses).toBe(2);
    cache.clearStats();
    expect(cache.stats()).toEqual({ hits: 0, misses: 0, writes: 0, corruptions: 0, versionMismatches: 0 });
  });

  it('atomic write leaves no temp file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mlb-cache-'));
    const cache = createMLBHistoricalCache({ root, version: 'v1' });
    await cache.set('/ep', {}, { data: 'ok' }, { endpoint: '/ep', fetchedAt: new Date(), sourceTimestamp: null });
    const files = await fs.readdir(root);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });
});
