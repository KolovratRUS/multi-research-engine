import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import * as os from 'os';
import * as path from 'path';
import {
  createMLBPregamePitcherObservationStore,
  buildObservationResponseHash,
  ELIGIBLE_PREGAME_PROVENANCES,
  PregamePitcherObservationStoreError,
  PregamePitcherObservation,
  AppendObservationResult,
  CanonicalJson,
  canonicalize,
  isPlainRecord,
} from '@/lib/backtesting/mlb/live-history/pregame-pitcher-observation-store';

function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'pregame-observation-store-'));
}

const createBaseGame = (): PregamePitcherObservation => ({
  schemaVersion: 'phase1g-a-v1',
  gamePk: 1001,
  sport: 'mlb',
  observedAt: new Date('2024-06-01T12:00:00Z'),
  scheduledStart: new Date('2024-06-01T18:30:00Z'),
  homeProbablePitcherId: 5001,
  awayProbablePitcherId: 5002,
  homeTeamId: 1,
  awayTeamId: 2,
  sourceEndpoint: '/api/v1/schedule',
  sourceRequestParameters: { sportId: 1 },
  sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3',
  observationContext: 'PROSPECTIVE_LIVE',
  provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
  warnings: [],
});

function makeObservation(overrides: Partial<PregamePitcherObservation> = {}): PregamePitcherObservation {
  return { ...createBaseGame(), ...overrides };
}

describe('createMLBPregamePitcherObservationStore', () => {
  it('appends one prospective observation', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const result = await store.append(makeObservation());
    expect(result.observationsConsidered).toBe(1);
    expect(result.observationsWritten).toBe(1);
    expect(result.exactDuplicatesSkipped).toBe(0);
    expect(result.retrospectiveWritesBlocked).toBe(0);
    expect(result.corruptRecords).toBe(0);
  });

  it('returns exact duplicate when appending the same observation twice', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const observation = makeObservation();
    const first = await store.append(observation);
    const second = await store.append(observation);
    expect(first.observationsWritten).toBe(1);
    expect(second.exactDuplicatesSkipped).toBe(1);
  });

  it('stores multiple observations for the same game', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const first = makeObservation({ observedAt: new Date('2024-06-01T12:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' });
    const second = makeObservation({ observedAt: new Date('2024-06-01T14:00:00Z'), sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' });
    await store.append(first);
    await store.append(second);
    const list = await store.listForGame(1001);
    expect(list).toHaveLength(2);
    expect(list[0].observedAt.getTime()).toBe(new Date('2024-06-01T12:00:00Z').getTime());
    expect(list[1].observedAt.getTime()).toBe(new Date('2024-06-01T14:00:00Z').getTime());
  });

  it('retains null pitcher IDs', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const result = await store.append(makeObservation({ homeProbablePitcherId: null, awayProbablePitcherId: null }));
    expect(result.observationsWritten).toBe(1);
    const list = await store.listForGame(1001);
    expect(list[0].homeProbablePitcherId).toBeNull();
    expect(list[0].awayProbablePitcherId).toBeNull();
  });

  it('does not overwrite a different observation at the same game', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    await store.append(makeObservation({ sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' }));
    const list = await store.listForGame(1001);
    expect(list).toHaveLength(2);
  });

  it('sorts games independently', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ gamePk: 2002, sourceResponseHash: '9f0d1db7634266b91158392b44338d35198f0a0ce29603edfb1ad0d80b81cf53' }));
    await store.append(makeObservation({ gamePk: 1001, sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    const list1001 = await store.listForGame(1001);
    const list2002 = await store.listForGame(2002);
    expect(list1001).toHaveLength(1);
    expect(list2002).toHaveLength(1);
  });

  it('returns deterministic tie break for equal observedAt', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const first = makeObservation({ sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3', observedAt: new Date('2024-06-01T12:00:00Z') });
    const second = makeObservation({ sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c', observedAt: new Date('2024-06-01T12:00:00Z') });
    await store.append(first);
    await store.append(second);
    const list = await store.listForGame(1001);
    expect(list[0].sourceResponseHash).toBe('163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c');
    expect(list[1].sourceResponseHash).toBe('9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3');
  });

  it('selects latest observation at or before cutoff', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T12:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T14:00:00Z'), sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' }));
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T16:00:00Z'), sourceResponseHash: '9f0d1db7634266b91158392b44338d35198f0a0ce29603edfb1ad0d80b81cf53' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T15:00:00Z'));
    expect(eligible?.sourceResponseHash).toBe('163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c');
  });

  it('selects latest pitcher change at or before cutoff', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const first = makeObservation({ observedAt: new Date('2024-06-01T12:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3', homeProbablePitcherId: 5001 });
    const second = makeObservation({ observedAt: new Date('2024-06-01T14:00:00Z'), sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c', homeProbablePitcherId: 6001 });
    await store.append(first);
    await store.append(second);
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T15:00:00Z'));
    expect(eligible?.homeProbablePitcherId).toBe(6001);
  });

  it('selects observation exactly at cutoff', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T12:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T15:00:00Z'), sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T15:00:00Z'));
    expect(eligible?.sourceResponseHash).toBe('163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c');
  });

  it('does not select observation after cutoff', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T16:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T15:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('does not select observation after scheduledStart', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T20:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T19:00:00Z'), sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T23:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('does not select retrospective-context observation', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ observationContext: 'RETROSPECTIVE_BACKTEST' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T20:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('does not select unknown-timestamp provenance', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ provenance: 'SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T20:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('does not select unavailable provenance', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ provenance: 'UNAVAILABLE' }));
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T20:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('returns null when no observations exist', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T20:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('returns [] when game directory does not exist', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const list = await store.listForGame(1001);
    expect(list).toEqual([]);
  });

  it('surfaces corrupt JSON as error instead of null', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const corruptDir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(corruptDir, { recursive: true });
    await fs.writeFile(path.join(corruptDir, 'bad.json'), 'not json', 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('surfaces schema-version mismatch as error instead of null', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'old.json'), JSON.stringify({ ...createBaseGame(), schemaVersion: 'old' }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('surfaces invalid record shape as error instead of null', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'shape.json'), JSON.stringify({ bad: true }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('rejects invalid dates during append', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const result = await store.append(makeObservation({ observedAt: new Date(NaN) }));
    expect(result.corruptRecords).toBe(1);
    expect(result.observationsWritten).toBe(0);
  });

  it('preserves input record without mutation', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const observation = makeObservation();
    const warningsBefore = [...observation.warnings];
    await store.append(observation);
    expect(observation.warnings).toEqual(warningsBefore);
  });

  it('blocks retrospective context writes while preserving prospective writes', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const retrospective = makeObservation({ observationContext: 'RETROSPECTIVE_BACKTEST' });
    const prospective = makeObservation({ observationContext: 'PROSPECTIVE_LIVE', sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' });
    const first = await store.append(retrospective);
    const second = await store.append(prospective);
    expect(first.retrospectiveWritesBlocked).toBe(1);
    expect(first.observationsWritten).toBe(0);
    expect(second.observationsWritten).toBe(1);
    expect(await store.listForGame(1001)).toHaveLength(1);
  });

  it('observations after scheduledStart are still stored but not eligible', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ observedAt: new Date('2024-06-01T20:00:00Z'), sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    const list = await store.listForGame(1001);
    expect(list).toHaveLength(1);
    const eligible = await store.findLatestEligible(1001, new Date('2024-06-01T23:00:00Z'));
    expect(eligible).toBeNull();
  });

  it('asserts exact storage path for an observation', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({
      observedAt: new Date('2024-06-01T12:00:00Z'),
      sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3',
    }));
    const expectedDir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    const files = await fs.readdir(expectedDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^1717243200000-9bfbaa33000f13e9\.json$/);
  });

  it('throws collision error when target path contains a different observation', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const observation = makeObservation({ sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' });
    await store.append(observation);
    const expectedDir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    const files = await fs.readdir(expectedDir);
    expect(files).toHaveLength(1);
    const targetPath = path.join(expectedDir, files[0]);
    const differentContent = JSON.stringify({ ...createBaseGame(), homeTeamId: 99999 });
    await fs.writeFile(targetPath, differentContent, 'utf8');
    await expect(store.append(observation)).rejects.toThrow(PregamePitcherObservationStoreError);
    expect(await fs.readFile(targetPath, 'utf8')).toBe(differentContent);
  });

  it('allows only one write and reports duplicates for concurrent identical appends', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const observation = makeObservation();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }).map(() => store.append(observation)),
    );
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<AppendObservationResult> => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(5);
    expect(fulfilled.filter((result) => result.value.observationsWritten === 1)).toHaveLength(1);
    expect(fulfilled.filter((result) => result.value.exactDuplicatesSkipped === 1)).toHaveLength(4);
    const files = await fs.readdir(path.join(root, 'pregame-pitcher-observations', 'mlb', '1001'));
    expect(files).toHaveLength(1);
  });

  it('rejects concurrent differing observations targeting the same filename', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const firstHash = 'aaaaaaaaaaaaaaaa000000000000000000000000000000000000000000000000';
    const secondHash = 'aaaaaaaaaaaaaaaa111111111111111111111111111111111111111111111111';
    expect(firstHash).toHaveLength(64);
    expect(secondHash).toHaveLength(64);
    expect(firstHash.slice(0, 16)).toBe(secondHash.slice(0, 16));
    expect(firstHash).not.toBe(secondHash);
    const first = makeObservation({
      observedAt: new Date('2024-06-01T12:00:00Z'),
      sourceResponseHash: firstHash,
    });
    const second = makeObservation({
      observedAt: new Date('2024-06-01T12:00:00Z'),
      sourceResponseHash: secondHash,
      awayTeamId: 3,
    });
    function serializeObservationForDisk(observation: PregamePitcherObservation): Record<string, unknown> {
      return {
        ...observation,
        observedAt: observation.observedAt.toISOString(),
        scheduledStart: observation.scheduledStart.toISOString(),
      };
    }
    const results = await Promise.allSettled([store.append(first), store.append(second)]);
    expect(results).toHaveLength(2);
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<AppendObservationResult> => result.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0].value.observationsWritten).toBe(1);
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected).toHaveLength(1);
    const reason = rejected[0].reason;
    expect(reason).toBeInstanceOf(PregamePitcherObservationStoreError);
    if (!(reason instanceof PregamePitcherObservationStoreError)) {
      throw new Error('expected store error');
    }
    expect(reason.cause).toBeInstanceOf(Error);
    expect((reason.cause as Error).message).toBe('hash collision');
    const expectedDir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    const files = await fs.readdir(expectedDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`^1717243200000-${firstHash.slice(0, 16)}\\.json$`));
    const raw = await fs.readFile(path.join(expectedDir, files[0]), 'utf8');
    const persisted = JSON.parse(raw) as unknown;
    expect([serializeObservationForDisk(first), serializeObservationForDisk(second)]).toContainEqual(persisted);
    const winnerIndex = results[0].status === 'fulfilled' ? 0 : 1;
    const winnerSerialized = serializeObservationForDisk(winnerIndex === 0 ? first : second);
    expect(persisted).toEqual(winnerSerialized);
  });

  it('rejects malformed schemaVersion', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bad-schema.json'), JSON.stringify({ ...createBaseGame(), schemaVersion: 'old' }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('rejects non-positive-integer team IDs', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bad-team.json'), JSON.stringify({ ...createBaseGame(), homeTeamId: '1' }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('rejects non-positive-integer pitcher IDs', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bad-pitcher.json'), JSON.stringify({ ...createBaseGame(), homeProbablePitcherId: '5001' }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('rejects non-string-array warnings', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bad-warnings.json'), JSON.stringify({ ...createBaseGame(), warnings: ['ok', 1] }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('rejects non-plain sourceRequestParameters', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bad-params.json'), JSON.stringify({ ...createBaseGame(), sourceRequestParameters: [] }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('rejects invalid sourceResponseHash', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const dir = path.join(root, 'pregame-pitcher-observations', 'mlb', '1001');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'bad-hash.json'), JSON.stringify({ ...createBaseGame(), sourceResponseHash: 'abc123' }), 'utf8');
    await expect(store.listForGame(1001)).rejects.toThrow(PregamePitcherObservationStoreError);
  });

  it('treats reordered request parameters as exact duplicates', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    const hash = buildObservationResponseHash({
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1, hydrate: 'probablePitcher' },
      observationContext: 'PROSPECTIVE_LIVE',
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
    });
    const first = makeObservation({
      sourceRequestParameters: { sportId: 1, hydrate: 'probablePitcher' },
      sourceResponseHash: hash,
    });
    const second = makeObservation({
      sourceRequestParameters: { hydrate: 'probablePitcher', sportId: 1 },
      sourceResponseHash: hash,
    });
    const firstResult = await store.append(first);
    const secondResult = await store.append(second);
    expect(firstResult.observationsWritten).toBe(1);
    expect(secondResult.exactDuplicatesSkipped).toBe(1);
    const files = await fs.readdir(path.join(root, 'pregame-pitcher-observations', 'mlb', '1001'));
    expect(files).toHaveLength(1);
  });

  it('isPlainRecord rejects Date', () => {
    expect(isPlainRecord(new Date())).toBe(false);
  });

  it('isPlainRecord rejects class instances', () => {
    class Custom {}
    expect(isPlainRecord(new Custom())).toBe(false);
  });

  it('treats different warnings as distinct', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3', warnings: ['a'] }));
    const result = await store.append(makeObservation({ sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c', warnings: ['b'] }));
    expect(result.exactDuplicatesSkipped).toBe(0);
    expect(result.observationsWritten).toBe(1);
  });

  it('treats different request parameters as distinct', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ sourceRequestParameters: { sportId: 1 }, sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    const result = await store.append(makeObservation({ sourceRequestParameters: { sportId: 2 }, sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' }));
    expect(result.exactDuplicatesSkipped).toBe(0);
    expect(result.observationsWritten).toBe(1);
  });

  it('treats different team IDs as distinct', async () => {
    const root = await createTempRoot();
    const store = createMLBPregamePitcherObservationStore(root);
    await store.append(makeObservation({ homeTeamId: 1, sourceResponseHash: '9bfbaa33000f13e966099b3d9a687372cc75ae014ccbbbba6d8f2a855daddff3' }));
    const result = await store.append(makeObservation({ homeTeamId: 99999, sourceResponseHash: '163b8a49834c75b4371f64ef09d4407dcbff3f37712187e1dd1c3df41052c88c' }));
    expect(result.exactDuplicatesSkipped).toBe(0);
    expect(result.observationsWritten).toBe(1);
  });
});

describe('buildObservationResponseHash', () => {
  it('returns a stable sha-256 hex string', () => {
    const hash = buildObservationResponseHash({
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      sourceRequestParameters: { sportId: 1 },
      observationContext: 'PROSPECTIVE_LIVE',
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT',
    });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('produces the same hash for reordered request parameters', () => {
    const base = {
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      observationContext: 'PROSPECTIVE_LIVE' as const,
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT' as const,
    };
    const first = buildObservationResponseHash({ ...base, sourceRequestParameters: { sportId: 1, hydrate: 'probablePitcher' } });
    const second = buildObservationResponseHash({ ...base, sourceRequestParameters: { hydrate: 'probablePitcher', sportId: 1 } });
    expect(first).toBe(second);
  });

  it('produces the same hash for nested reordered request parameters', () => {
    const base = {
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      observationContext: 'PROSPECTIVE_LIVE' as const,
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT' as const,
    };
    const first = buildObservationResponseHash({
      ...base,
      sourceRequestParameters: { filter: { sportId: 1, hydrate: 'probablePitcher' } },
    });
    const second = buildObservationResponseHash({
      ...base,
      sourceRequestParameters: { filter: { hydrate: 'probablePitcher', sportId: 1 } },
    });
    expect(first).toBe(second);
  });

  it('produces different hashes for different array orders', () => {
    const base = {
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      observationContext: 'PROSPECTIVE_LIVE' as const,
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT' as const,
    };
    const first = buildObservationResponseHash({ ...base, sourceRequestParameters: { fields: ['a', 'b'] } });
    const second = buildObservationResponseHash({ ...base, sourceRequestParameters: { fields: ['b', 'a'] } });
    expect(first).not.toBe(second);
  });

  it('rejects unsupported values during hashing', () => {
    const base = {
      gamePk: 1001,
      scheduledStart: new Date('2024-06-01T18:30:00Z'),
      homeTeamId: 1,
      awayTeamId: 2,
      homeProbablePitcherId: 5001,
      awayProbablePitcherId: 5002,
      sourceEndpoint: '/api/v1/schedule',
      observationContext: 'PROSPECTIVE_LIVE' as const,
      provenance: 'SCHEDULE_PROBABLE_OBSERVED_AT' as const,
    };
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { when: new Date() } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { map: new Map() } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { set: new Set() } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { fn: () => {} } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { sym: Symbol('x') } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { big: BigInt(1) } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { nan: NaN } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { inf: Infinity } })).toThrow();
    expect(() => buildObservationResponseHash({ ...base, sourceRequestParameters: { undef: undefined } })).toThrow();
  });
});

describe('canonicalize', () => {
  it('passes through scalars', () => {
    expect(canonicalize(null)).toBeNull();
    expect(canonicalize(true)).toBe(true);
    expect(canonicalize('abc')).toBe('abc');
    expect(canonicalize(0)).toBe(0);
  });

  it('sorts object keys recursively', () => {
    expect(canonicalize({ b: 2, a: 1 })).toEqual({ a: 1, b: 2 });
    expect(canonicalize({ outer: { b: 2, a: 1 } })).toEqual({ outer: { a: 1, b: 2 } });
  });

  it('preserves array order', () => {
    expect(canonicalize(['b', 'a'])).toEqual(['b', 'a']);
    expect(canonicalize({ arr: [2, 1] })).toEqual({ arr: [2, 1] });
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize(NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
  });

  it('rejects Date, Map, Set, class instances, functions, symbols, bigint, and undefined', () => {
    expect(() => canonicalize(new Date())).toThrow();
    expect(() => canonicalize(new Map())).toThrow();
    expect(() => canonicalize(new Set())).toThrow();
    class Custom {}
    expect(() => canonicalize(new Custom())).toThrow();
    expect(() => canonicalize(() => {})).toThrow();
    expect(() => canonicalize(Symbol('x'))).toThrow();
    expect(() => canonicalize(BigInt(1))).toThrow();
    expect(() => canonicalize(undefined)).toThrow();
  });

  it('detects cyclic objects', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => canonicalize(cyclic)).toThrow();
  });

  it('detects cyclic arrays', () => {
    const cyclic: unknown[] = [];
    cyclic.push(cyclic);
    let captured: Error | undefined;
    try {
      canonicalize(cyclic);
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).toBeInstanceOf(Error);
    expect(captured?.message).toBe('cyclic structure in canonical payload');
    expect(captured).not.toBeInstanceOf(RangeError);
  });

  it('detects mixed object-array-object cycle', () => {
    const parent: Record<string, unknown> = { children: [] };
    (parent.children as unknown[]).push({ parent });
    expect(() => canonicalize(parent)).toThrow('cyclic structure in canonical payload');
  });

  it('detects mixed array-object-array cycle', () => {
    const outer: unknown[] = [];
    const inner: Record<string, unknown> = { back: outer };
    outer.push(inner);
    expect(() => canonicalize(outer)).toThrow('cyclic structure in canonical payload');
  });

  it('preserves shared non-cyclic references', () => {
    const shared = { value: 1 };
    const input = { first: shared, second: shared };
    expect(canonicalize(input)).toEqual({ first: { value: 1 }, second: { value: 1 } });
  });

  it('preserves shared array referenced from multiple object properties', () => {
    const shared = [1, 2];
    const input = { a: shared, b: shared };
    expect(canonicalize(input)).toEqual({ a: [1, 2], b: [1, 2] });
  });
});

describe('ELIGIBLE_PREGAME_PROVENANCES', () => {
  it('contains only explicitly eligible provenance values', () => {
    expect(ELIGIBLE_PREGAME_PROVENANCES.has('SCHEDULE_PROBABLE_OBSERVED_AT')).toBe(true);
    expect(ELIGIBLE_PREGAME_PROVENANCES.has('SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN')).toBe(false);
    expect(ELIGIBLE_PREGAME_PROVENANCES.has('UNAVAILABLE')).toBe(false);
  });
});
