import { describe, it, expect } from 'vitest';
import {
  buildMLBLocalDryRunManifest,
  buildMLBLocalDryRunScheduleSnapshot,
  buildMLBLocalDryRunPregameResearchSnapshots,
  buildMLBLocalDryRunLockedWeeklyOutput,
  buildMLBLocalDryRunOutcomeAttachments,
  buildMLBLocalDryRunEvaluationReport,
} from '@/prospective/mlb/local-dry-run-sample';
import {
  validateProspectiveScheduleSnapshot,
  validatePregameResearchSnapshot,
  validateLockedWeeklyOutput,
  validateOutcomeAttachment,
} from '@/prospective/mlb/weekly-test-schemas';
import { buildMLBFixtureInventory } from '../../scripts/mlb-fixture-inventory';

describe('Phase 4C MLB prospective weekly: local dry-run sample', () => {
  it('manifest has expected runId, sport MLB, sourceMode local-dry-run, and status planned', () => {
    const manifest = buildMLBLocalDryRunManifest();
    expect(manifest.runId).toBe('mlb-local-dry-run-2024-07-sample');
    expect(manifest.sport).toBe('MLB');
    expect(manifest.sourceMode).toBe('local-dry-run');
    expect(manifest.status).toBe('planned');
    expect(manifest.weekStart).toBe('2024-07-01');
    expect(manifest.weekEnd).toBe('2024-07-07');
  });

  it('schedule snapshot passes validation and games contain no finalScore/completedGameState', () => {
    const snapshot = buildMLBLocalDryRunScheduleSnapshot();
    const messages = validateProspectiveScheduleSnapshot(snapshot);
    expect(messages).toEqual([]);

    for (const game of snapshot.games) {
      expect('finalScore' in (game as object)).toBe(false);
      expect('completedGameState' in (game as object)).toBe(false);
    }
  });

  it('pregame research snapshots pass validation and every modelProbability is exactly null', () => {
    const snapshots = buildMLBLocalDryRunPregameResearchSnapshots();
    expect(snapshots.length).toBeGreaterThan(0);

    for (const snapshot of snapshots) {
      expect(snapshot.runId).toBe('mlb-local-dry-run-2024-07-sample');
      expect(snapshot.modelProbability).toBeNull();
      const messages = validatePregameResearchSnapshot(snapshot);
      expect(messages).toEqual([]);
    }
  });

  it('locked weekly output passes validation', () => {
    const output = buildMLBLocalDryRunLockedWeeklyOutput();
    expect(output.runId).toBe('mlb-local-dry-run-2024-07-sample');
    const messages = validateLockedWeeklyOutput(output);
    expect(messages).toEqual([]);
  });

  it('outcome attachments pass validation', () => {
    const attachments = buildMLBLocalDryRunOutcomeAttachments();
    expect(attachments.length).toBeGreaterThan(0);

    for (const attachment of attachments) {
      expect(attachment.runId).toBe('mlb-local-dry-run-2024-07-sample');
      const messages = validateOutcomeAttachment(attachment);
      expect(messages).toEqual([]);
    }
  });

  it('evaluation report references the same runId', () => {
    const report = buildMLBLocalDryRunEvaluationReport();
    expect(report.runId).toBe('mlb-local-dry-run-2024-07-sample');
    expect(report.gamesProcessed).toBe(3);
    expect(report.lockedOutputs).toBe(1);
    expect(report.outcomesAttached).toBe(3);
    expect(report.calibrationStatus).toBe('not-calibrated');
    expect(report.modelProbabilityStatus).toBe('null');
  });

  it('does not change historical fixture inventory (29 total games, 17 June, 12 July)', () => {
    const inventory = buildMLBFixtureInventory();
    expect(inventory.totalGames).toBe(29);
    expect(inventory.gamesByMonth['2024-06']).toBe(17);
    expect(inventory.gamesByMonth['2024-07']).toBe(12);
  });
});
