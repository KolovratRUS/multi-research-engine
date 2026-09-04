import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

vi.mock(
  '../../../scripts/mlb-prospective-holdout-progress',
  () => ({
    runMLBProspectiveHoldoutProgress: vi.fn(),
  }),
);

import {
  runMLBProspectiveHoldoutSmokePreflight,
  runMLBProspectiveHoldoutSmokePreflightCLI,
  type MLBProspectiveHoldoutSmokePreflightDependencies,
} from '../../../scripts/mlb-prospective-holdout-smoke-preflight';

import {
  runMLBProspectiveHoldoutProgress,
} from '../../../scripts/mlb-prospective-holdout-progress';

const mockRunProgress = vi.mocked(runMLBProspectiveHoldoutProgress);

/* -------------------------------------------------------------------------- */
/*  Fixture builders                                                          */
/* -------------------------------------------------------------------------- */

function buildProgressReport(
  overrides: Partial<import('@/prediction/mlb/mlb-prospective-holdout-progress-report').MLBProspectiveHoldoutProgressReport> = {},
): import('@/prediction/mlb/mlb-prospective-holdout-progress-report').MLBProspectiveHoldoutProgressReport {
  const base: import('@/prediction/mlb/mlb-prospective-holdout-progress-report').MLBProspectiveHoldoutProgressReport = {
    contractVersion: 'mlb-prospective-holdout-progress-report-v1',
    activationId: 'activation-900001',
    protocolId: 'mlb-v1-candidate-003-prospective-holdout-v1',
    candidateRecipeId: 'candidate-recipe-1',
    candidateFingerprint: 'fingerprint-1',
    validationBoundaryOfficialDate: '2026-09-15',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: 'scheduledStartAt_ASC_gamePk_ASC',
    resultIndependentSelection: true,
    testAuthorizationRule: 'NO_TEST_AUTHORIZATION',
    validationCapturedCount: 0,
    validationCapturedGamePks: [],
    validationCaptureComplete: false,
    validationRemainingCount: 67,
    testCapturedCount: 0,
    testCapturedGamePks: [],
    testCaptureComplete: false,
    testRemainingCount: 69,
    totalCapturedCount: 0,
    totalTargetCount: 136,
    totalRemainingCount: 136,
    allCaptureComplete: false,
    anomalies: {
      orphanEvidenceCount: 0,
      foreignEvidenceCount: 0,
      foreignBindingCount: 0,
      temporaryDebrisCount: 0,
      unknownFilesCount: 0,
    },
  };
  return { ...base, ...overrides };
}

function buildProvider(
  implementation: (date: string) => unknown = () => ({ games: [] }),
) {
  const fetchSchedule = vi.fn((date: string) => Promise.resolve(implementation(date)));
  return { fetchSchedule };
}

function buildDeps(
  overrides: Partial<MLBProspectiveHoldoutSmokePreflightDependencies> = {},
): MLBProspectiveHoldoutSmokePreflightDependencies {
  const now = overrides.now ?? (() => new Date('2026-09-01T00:00:00Z'));
  return {
    now,
    provider: overrides.provider ?? buildProvider(),
    repositoryRoot: overrides.repositoryRoot,
  };
}

function mockProgressSuccess(
  overrides: Partial<import('@/prediction/mlb/mlb-prospective-holdout-progress-report').MLBProspectiveHoldoutProgressReport> = {},
) {
  mockRunProgress.mockResolvedValue({
    ok: true,
    report: buildProgressReport(overrides),
  });
}

/* -------------------------------------------------------------------------- */
/*  CLI harness                                                               */
/* -------------------------------------------------------------------------- */

interface CLITestResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function invokeCLI(
  argv: readonly string[],
  deps?: Parameters<typeof runMLBProspectiveHoldoutSmokePreflight>[1],
): Promise<CLITestResult> {
  let stdout = '';
  let stderr = '';
  const exitCode = await runMLBProspectiveHoldoutSmokePreflightCLI(
    ['node', 'script', ...argv],
    {
      stdout: (text: string) => { stdout += text; },
      stderr: (text: string) => { stderr += text; },
    },
    deps,
  );
  return { exitCode, stdout, stderr };
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-smoke-preflight-cli', () => {
  beforeEach(() => {
    mockRunProgress.mockClear();
  });

  // 1. zero-arg success invocation
  it('1. zero-arg success invocation', async () => {
    mockProgressSuccess();
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-01') {
        return {
          games: [
            {
              gamePk: 100001,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      if (date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('selectedGamePk', 100001);
    expect(result.stderr).toBe('');
  });

  // 2. extra arg → INVALID_ARGUMENTS
  it('2. extra arg maps to INVALID_ARGUMENTS', async () => {
    const result = await invokeCLI(['--extra']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'INVALID_ARGUMENTS' });
    expect(mockRunProgress).toHaveBeenCalledTimes(0);
  });

  // 3. invalid args call L3 zero times
  it('3. invalid args call L3 zero times', async () => {
    const result = await invokeCLI(['--unknown']);
    expect(mockRunProgress).toHaveBeenCalledTimes(0);
  });

  // 4. invalid args sample clock zero times
  it('4. invalid args sample clock zero times', async () => {
    const now = vi.fn();
    await invokeCLI(['--bad'], buildDeps({ now }));
    expect(now).toHaveBeenCalledTimes(0);
  });

  // 5. invalid args fetch schedule zero times
  it('5. invalid args fetch schedule zero times', async () => {
    const provider = buildProvider();
    await invokeCLI(['--bad'], buildDeps({ provider }));
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(0);
  });

  // 6. ACTIVATION_UNAVAILABLE propagation
  it('6. ACTIVATION_UNAVAILABLE propagation', async () => {
    mockRunProgress.mockResolvedValue({
      ok: false,
      error: { kind: 'ACTIVATION_UNAVAILABLE', issues: [{ code: 'ACTIVATION_MISSING', path: '$', message: 'missing' }] },
    });
    const result = await invokeCLI([]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'ACTIVATION_UNAVAILABLE' });
  });

  // 7. ACTIVATION_READ_FAILURE propagation
  it('7. ACTIVATION_READ_FAILURE propagation', async () => {
    mockRunProgress.mockResolvedValue({
      ok: false,
      error: { kind: 'ACTIVATION_READ_FAILURE', issues: [{ code: 'ACTIVATION_IO_ERROR', path: '$', message: 'io error' }] },
    });
    const result = await invokeCLI([]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'ACTIVATION_READ_FAILURE' });
  });

  // 8. ACTIVATION_STATE_INVALID propagation
  it('8. ACTIVATION_STATE_INVALID propagation', async () => {
    mockRunProgress.mockResolvedValue({
      ok: false,
      error: { kind: 'ACTIVATION_STATE_INVALID', issues: [{ code: 'ACTIVATION_CONTRACT_INVALID', path: '$', message: 'invalid' }] },
    });
    const result = await invokeCLI([]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'ACTIVATION_STATE_INVALID' });
  });

  // 9. DISCOVERY_FAILURE propagation
  it('9. DISCOVERY_FAILURE propagation', async () => {
    mockRunProgress.mockResolvedValue({
      ok: false,
      error: { kind: 'DISCOVERY_FAILURE', issues: [{ code: 'DISCOVERY_ISSUE', path: '$', message: 'discovery failed' }] },
    });
    const result = await invokeCLI([]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'DISCOVERY_FAILURE' });
  });

  // 10. PROGRESS_INTEGRITY_CONFLICT propagation
  it('10. PROGRESS_INTEGRITY_CONFLICT propagation', async () => {
    mockRunProgress.mockResolvedValue({
      ok: false,
      error: { kind: 'PROGRESS_INTEGRITY_CONFLICT', issues: [{ code: 'RESCHEDULE_CONFLICT', path: '$', message: 'conflict' }] },
    });
    const result = await invokeCLI([]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'PROGRESS_INTEGRITY_CONFLICT' });
  });

  // 11. CAPTURE_COUNT_EXCEEDS_TARGET propagation
  it('11. CAPTURE_COUNT_EXCEEDS_TARGET propagation', async () => {
    mockRunProgress.mockResolvedValue({
      ok: false,
      error: { kind: 'CAPTURE_COUNT_EXCEEDS_TARGET', issues: [{ code: 'CAPTURE_COUNT_EXCEEDS_TARGET', path: '$', message: 'too many' }] },
    });
    const result = await invokeCLI([]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'CAPTURE_COUNT_EXCEEDS_TARGET' });
  });

  // 12. nonzero progress → no clock/network
  it('12. nonzero progress causes no clock or network calls', async () => {
    mockProgressSuccess({ validationCapturedCount: 1 });
    const now = vi.fn();
    const provider = buildProvider();
    const result = await invokeCLI([], buildDeps({ now, provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'FIRST_SMOKE_PROGRESS_NOT_ZERO' });
    expect(now).toHaveBeenCalledTimes(0);
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(0);
  });

  // 13. nonzero anomaly → no clock/network
  it('13. nonzero anomaly causes no clock or network calls', async () => {
    mockProgressSuccess({ anomalies: { orphanEvidenceCount: 1, foreignEvidenceCount: 0, foreignBindingCount: 0, temporaryDebrisCount: 0, unknownFilesCount: 0 } });
    const now = vi.fn();
    const provider = buildProvider();
    const result = await invokeCLI([], buildDeps({ now, provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE' });
    expect(now).toHaveBeenCalledTimes(0);
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(0);
  });

  // 14. unexpected testAuthorizationRule → no clock/network
  it('14. unexpected testAuthorizationRule causes no clock or network calls', async () => {
    mockProgressSuccess({ testAuthorizationRule: 'UNKNOWN' });
    const now = vi.fn();
    const provider = buildProvider();
    const result = await invokeCLI([], buildDeps({ now, provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'ACTIVATION_STATE_INVALID' });
    expect(now).toHaveBeenCalledTimes(0);
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(0);
  });

  // 15. clock sampled exactly once on valid local state
  it('15. clock sampled exactly once on valid local state', async () => {
    mockProgressSuccess();
    const now = vi.fn(() => new Date('2026-09-01T00:00:00Z'));
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-01' || date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    await invokeCLI([], buildDeps({ now, provider }));
    expect(now).toHaveBeenCalledTimes(1);
  });

  // 16. scan starts at trusted UTC date
  it('16. scan starts at trusted UTC date', async () => {
    mockProgressSuccess();
    const now = vi.fn(() => new Date('2026-09-10T00:00:00Z'));
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-10' || date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    await invokeCLI([], buildDeps({ now, provider }));
    expect(provider.fetchSchedule).toHaveBeenNthCalledWith(1, '2026-09-10');
  });

  // 17. scan ends exactly validation boundary
  it('17. scan ends exactly validation boundary', async () => {
    mockProgressSuccess();
    const now = vi.fn(() => new Date('2026-09-10T00:00:00Z'));
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-10' || date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    await invokeCLI([], buildDeps({ now, provider }));
    const calls = provider.fetchSchedule.mock.calls.map((call: readonly [string]) => call[0]);
    expect(calls[calls.length - 1]).toBe('2026-09-15');
  });

  // 18. start after boundary → zero schedule calls
  it('18. start after boundary causes zero schedule calls', async () => {
    mockProgressSuccess({ validationBoundaryOfficialDate: '2026-09-10' });
    const now = vi.fn(() => new Date('2026-09-15T00:00:00Z'));
    const provider = buildProvider();
    const result = await invokeCLI([], buildDeps({ now, provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(0);
  });

  // 19. year mismatch → zero schedule calls
  it('19. year mismatch causes zero schedule calls', async () => {
    mockProgressSuccess({ validationBoundaryOfficialDate: '2027-09-15' });
    const now = vi.fn(() => new Date('2026-09-15T00:00:00Z'));
    const provider = buildProvider();
    const result = await invokeCLI([], buildDeps({ now, provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(0);
  });

  // 20. zero-game date continues traversal
  it('20. zero-game date continues traversal', async () => {
    mockProgressSuccess({ validationBoundaryOfficialDate: '2026-09-02' });
    const now = vi.fn(() => new Date('2026-09-01T00:00:00Z'));
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-01') return { games: [] };
      if (date === '2026-09-02') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: '2026-09-02',
              startTimeUtc: new Date('2026-09-02T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    const result = await invokeCLI([], buildDeps({ now, provider }));
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty('selectedGamePk', 123456);
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(2);
  });

  // 21. never fetch post-boundary date
  it('21. never fetch post-boundary date', async () => {
    mockProgressSuccess();
    const now = vi.fn(() => new Date('2026-09-14T00:00:00Z'));
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-14' || date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    await invokeCLI([], buildDeps({ now, provider }));
    expect(provider.fetchSchedule).not.toHaveBeenCalledWith('2026-09-16');
  });

  // 22. never fetch next-year date
  it('22. never fetch next-year date', async () => {
    mockProgressSuccess({ validationBoundaryOfficialDate: '2026-12-31' });
    const now = vi.fn(() => new Date('2026-12-31T00:00:00Z'));
    const provider = buildProvider((date: string) => {
      if (date === '2026-12-31') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: '2026-12-31',
              startTimeUtc: new Date('2026-12-31T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    await invokeCLI([], buildDeps({ now, provider }));
    expect(provider.fetchSchedule).toHaveBeenCalledTimes(1);
    expect(provider.fetchSchedule).not.toHaveBeenCalledWith('2027-01-01');
  });

  // 23. provider exception → SCHEDULE_FETCH_FAILURE
  it('23. provider exception maps to SCHEDULE_FETCH_FAILURE', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => {
      throw new Error('network down');
    });
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_FETCH_FAILURE' });
  });

  // 24. non-object result → SCHEDULE_STATE_INVALID
  it('24. non-object result maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => null);
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 25. games not array → SCHEDULE_STATE_INVALID
  it('25. games not array maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({ games: 'not-array' }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 26. invalid gamePk → SCHEDULE_STATE_INVALID
  it('26. invalid gamePk maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({
      games: [
        {
          gamePk: 0,
          gameType: 'R',
          officialDate: '2026-09-15',
          startTimeUtc: new Date('2026-09-15T18:00:00Z'),
          status: 'UPCOMING',
        },
      ],
    }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 27. invalid officialDate → SCHEDULE_STATE_INVALID
  it('27. invalid officialDate maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({
      games: [
        {
          gamePk: 123456,
          gameType: 'R',
          officialDate: 'bad-date',
          startTimeUtc: new Date('2026-09-15T18:00:00Z'),
          status: 'UPCOMING',
        },
      ],
    }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 28. invalid startTimeUtc → SCHEDULE_STATE_INVALID
  it('28. invalid startTimeUtc maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({
      games: [
        {
          gamePk: 123456,
          gameType: 'R',
          officialDate: '2026-09-15',
          startTimeUtc: 'not-a-date',
          status: 'UPCOMING',
        },
      ],
    }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 29. unknown status → SCHEDULE_STATE_INVALID
  it('29. unknown status maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({
      games: [
        {
          gamePk: 123456,
          gameType: 'R',
          officialDate: '2026-09-15',
          startTimeUtc: new Date('2026-09-15T18:00:00Z'),
          status: 'UNKNOWN',
        },
      ],
    }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 30. out-of-requested-date officialDate → SCHEDULE_STATE_INVALID
  it('30. out-of-requested-date officialDate maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({
      games: [
        {
          gamePk: 123456,
          gameType: 'R',
          officialDate: '2026-09-16',
          startTimeUtc: new Date('2026-09-16T18:00:00Z'),
          status: 'UPCOMING',
        },
      ],
    }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 31. duplicate gamePk same date → SCHEDULE_STATE_INVALID
  it('31. duplicate gamePk same date maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider(() => ({
      games: [
        {
          gamePk: 123456,
          gameType: 'R',
          officialDate: '2026-09-15',
          startTimeUtc: new Date('2026-09-15T18:00:00Z'),
          status: 'UPCOMING',
        },
        {
          gamePk: 123456,
          gameType: 'R',
          officialDate: '2026-09-15',
          startTimeUtc: new Date('2026-09-15T21:00:00Z'),
          status: 'UPCOMING',
        },
      ],
    }));
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 32. duplicate gamePk different dates → SCHEDULE_STATE_INVALID
  it('32. duplicate gamePk different dates maps to SCHEDULE_STATE_INVALID', async () => {
    mockProgressSuccess();
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-14') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: '2026-09-14',
              startTimeUtc: new Date('2026-09-14T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      if (date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: '2026-09-15',
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({ kind: 'SCHEDULE_STATE_INVALID' });
  });

  // 33. valid doubleheader distinct gamePks accepted
  it('33. valid doubleheader distinct gamePks accepted', async () => {
    mockProgressSuccess();
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 100000,
              gameType: 'R',
              officialDate: '2026-09-15',
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
            {
              gamePk: 100001,
              gameType: 'R',
              officialDate: '2026-09-15',
              startTimeUtc: new Date('2026-09-15T21:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveProperty('selectedGamePk', 100000);
  });

  // 34. repo root module-relative
  it('34. repo root module-relative', async () => {
    mockProgressSuccess();
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-01' || date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    await invokeCLI([], buildDeps({ provider }));
    expect(mockRunProgress).toHaveBeenCalledTimes(1);
    expect(mockRunProgress).toHaveBeenNthCalledWith(
      1,
      expect.any(Array),
      expect.objectContaining({ repositoryRoot: REPO_ROOT }),
    );
  });

  // 35. CWD independent
  it('35. CWD independent', async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir('/tmp');
      mockProgressSuccess();
      const provider = buildProvider((date: string) => {
        if (date === '2026-09-01' || date === '2026-09-15') {
          return {
            games: [
              {
                gamePk: 123456,
                gameType: 'R',
                officialDate: date,
                startTimeUtc: new Date('2026-09-15T18:00:00Z'),
                status: 'UPCOMING',
              },
            ],
          };
        }
        return { games: [] };
      });
      await invokeCLI([], buildDeps({ provider }));
      expect(mockRunProgress).toHaveBeenNthCalledWith(
        1,
        expect.any(Array),
        expect.objectContaining({ repositoryRoot: REPO_ROOT }),
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  // 36. import inert
  it('36. import inert', async () => {
    // The module was already imported at the top of this file.
    expect(mockRunProgress).toHaveBeenCalledTimes(0);
  });

  // 37. success stdout JSON / stderr empty / exit 0
  it('37. success stdout JSON / stderr empty / exit 0', async () => {
    mockProgressSuccess();
    const provider = buildProvider((date: string) => {
      if (date === '2026-09-01') {
        return {
          games: [
            {
              gamePk: 100001,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      if (date === '2026-09-15') {
        return {
          games: [
            {
              gamePk: 123456,
              gameType: 'R',
              officialDate: date,
              startTimeUtc: new Date('2026-09-15T18:00:00Z'),
              status: 'UPCOMING',
            },
          ],
        };
      }
      return { games: [] };
    });
    const result = await invokeCLI([], buildDeps({ provider }));
    expect(result.exitCode).toBe(0);
    expect(() => JSON.parse(result.stdout)).not.toThrow();
    expect(result.stderr).toBe('');
  });

  // 38. failure stdout empty / stderr JSON / exit 1
  it('38. failure stdout empty / stderr JSON / exit 1', async () => {
    const result = await invokeCLI(['--bad']);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(() => JSON.parse(result.stderr)).not.toThrow();
  });

  // 39. no K1 invocation
  it('39. source does not import capture orchestrator', async () => {
    const source = await fs.readFile(
      path.resolve('scripts/mlb-prospective-holdout-smoke-preflight.ts'),
      'utf-8',
    );
    expect(source).not.toMatch(/mlb-prospective-holdout-capture-orchestrator/);
    expect(source).not.toMatch(/runProspectiveHoldoutCaptureOrchestrator/);
  });

  // 40. no K2 invocation
  it('40. source does not import capture script', async () => {
    const source = await fs.readFile(
      path.resolve('scripts/mlb-prospective-holdout-smoke-preflight.ts'),
      'utf-8',
    );
    expect(source).not.toMatch(/mlb-prospective-holdout-capture\.ts/);
  });

  // 41. no capture execution/spawn
  it('41. source does not spawn or execute capture', async () => {
    const source = await fs.readFile(
      path.resolve('scripts/mlb-prospective-holdout-smoke-preflight.ts'),
      'utf-8',
    );
    expect(source).not.toMatch(/child_process/);
    expect(source).not.toMatch(/spawn\(/);
    expect(source).not.toMatch(/exec\(/);
    expect(source).not.toMatch(/fork\(/);
    expect(source).not.toMatch(/execFile\(/);
  });

  // 42. no activation/evidence/binding writes
  it('42. source does not write activation evidence or binding artifacts', async () => {
    const source = await fs.readFile(
      path.resolve('scripts/mlb-prospective-holdout-smoke-preflight.ts'),
      'utf-8',
    );
    expect(source).not.toMatch(/fs\.writeFile/);
    expect(source).not.toMatch(/writeActivation/);
    expect(source).not.toMatch(/writeEvidence/);
    expect(source).not.toMatch(/writeBinding/);
    expect(source).not.toMatch(/persistProspective/);
  });
});
