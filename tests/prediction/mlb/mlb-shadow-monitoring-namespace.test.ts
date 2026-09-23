import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
  MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE,
  MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE,
  MLB_SHADOW_MONITORING_QUARANTINE_OUTCOMES_NAMESPACE,
  MLB_SHADOW_MONITORING_QUARANTINE_GRADING_NAMESPACE,
  resolveShadowMonitoringNamespacePath,
  resolveShadowMonitoringOperationalPath,
  resolveShadowMonitoringQuarantinePredictionsPath,
  resolveShadowMonitoringQuarantineOutcomesPath,
  resolveShadowMonitoringQuarantineGradingPath,
  isWithinShadowMonitoringRoot,
  isWithinProtectedScientificPath,
} from '@/prediction/mlb/mlb-shadow-monitoring-namespace';
import {
  MLB_SHADOW_MONITORING_PROTECTED_PATHS,
  MLB_SHADOW_MONITORING_PROTECTED_PATHS as PROTECTED,
} from '@/prediction/mlb/mlb-shadow-monitoring-firewall';

const REPO_ROOT = '/tmp/test-repo-shadow-monitoring';

describe('mlb-shadow-monitoring-namespace', () => {
  /* 1. canonical root exact */
  it('exports canonical root constant', () => {
    expect(MLB_SHADOW_MONITORING_NAMESPACE_ROOT).toBe(
      'var/mlb-development/mlb-shadow-monitoring',
    );
  });

  it('exports canonical operational namespace', () => {
    expect(MLB_SHADOW_MONITORING_OPERATIONAL_NAMESPACE).toBe(
      'var/mlb-development/mlb-shadow-monitoring/operational',
    );
  });

  it('exports canonical quarantine prediction namespace', () => {
    expect(MLB_SHADOW_MONITORING_QUARANTINE_PREDICTIONS_NAMESPACE).toBe(
      'var/mlb-development/mlb-shadow-monitoring/quarantine/predictions',
    );
  });

  it('exports canonical quarantine outcome namespace', () => {
    expect(MLB_SHADOW_MONITORING_QUARANTINE_OUTCOMES_NAMESPACE).toBe(
      'var/mlb-development/mlb-shadow-monitoring/quarantine/outcomes',
    );
  });

  it('exports canonical quarantine grading namespace', () => {
    expect(MLB_SHADOW_MONITORING_QUARANTINE_GRADING_NAMESPACE).toBe(
      'var/mlb-development/mlb-shadow-monitoring/quarantine/grading',
    );
  });

  /* 2. operational path is descendant of root */
  it('operational path is a descendant of root', () => {
    const result = resolveShadowMonitoringOperationalPath(REPO_ROOT);
    expect(result.resolved).toBe(
      path.join(REPO_ROOT, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, 'operational'),
    );
    expect(
      path.relative(result.shadowRoot, result.resolved),
    ).toBe('operational');
    expect(isWithinShadowMonitoringRoot(result.resolved, REPO_ROOT)).toBe(true);
  });

  /* 3. prediction quarantine path is descendant */
  it('prediction quarantine path is a descendant of root', () => {
    const result = resolveShadowMonitoringQuarantinePredictionsPath(REPO_ROOT);
    expect(result.resolved).toBe(
      path.join(
        REPO_ROOT,
        MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
        'quarantine/predictions',
      ),
    );
    expect(isWithinShadowMonitoringRoot(result.resolved, REPO_ROOT)).toBe(true);
  });

  /* 4. outcome quarantine path is descendant */
  it('outcome quarantine path is a descendant of root', () => {
    const result = resolveShadowMonitoringQuarantineOutcomesPath(REPO_ROOT);
    expect(result.resolved).toBe(
      path.join(
        REPO_ROOT,
        MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
        'quarantine/outcomes',
      ),
    );
    expect(isWithinShadowMonitoringRoot(result.resolved, REPO_ROOT)).toBe(true);
  });

  /* 5. grading quarantine path is descendant */
  it('grading quarantine path is a descendant of root', () => {
    const result = resolveShadowMonitoringQuarantineGradingPath(REPO_ROOT);
    expect(result.resolved).toBe(
      path.join(
        REPO_ROOT,
        MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
        'quarantine/grading',
      ),
    );
    expect(isWithinShadowMonitoringRoot(result.resolved, REPO_ROOT)).toBe(true);
  });

  /* 6. path traversal rejected */
  it('rejects relative path traversal (../)', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(REPO_ROOT, '../../etc/passwd'),
    ).toThrow();
  });

  it('rejects deep relative path traversal (../../)', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(REPO_ROOT, '../../../etc/passwd'),
    ).toThrow();
  });

  it('rejects path traversal with dot components', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(REPO_ROOT, './.././../etc/shadow'),
    ).toThrow();
  });

  /* 7. absolute external path rejected */
  it('rejects absolute external path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(REPO_ROOT, '/etc/passwd'),
    ).toThrow();
  });

  it('rejects absolute path on macOS', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(REPO_ROOT, '/Users/sam/.ssh/id_rsa'),
    ).toThrow();
  });

  it('rejects empty segment traversal', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(REPO_ROOT, ''),
    ).toThrow();
  });

  it('rejects null-byte injection in path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        'operational/\x00../../etc/passwd',
      ),
    ).toThrow();
  });

  it('rejects null-byte in otherwise-valid subpath', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        'operational/\x00evil',
      ),
    ).toThrow();
  });

  it('rejects null-byte before protected sibling escape', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../\x00protected',
      ),
    ).toThrow();
  });

  /* 8. protected activation path unreachable */
  it('rejects resolution into protected activation path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../mlb-prospective-holdout-activations/live-001.json',
      ),
    ).toThrow();
    const escaped = path.resolve(
      REPO_ROOT,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      '../mlb-prospective-holdout-activations/live-001.json',
    );
    expect(
      isWithinProtectedScientificPath(escaped, REPO_ROOT),
    ).toBe(true);
  });

  /* 9. protected evidence path unreachable */
  it('rejects resolution into protected evidence path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../mlb-prospective-pregame-evidence/artifact.json',
      ),
    ).toThrow();
    const escaped = path.resolve(
      REPO_ROOT,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      '../mlb-prospective-pregame-evidence/artifact.json',
    );
    expect(
      isWithinProtectedScientificPath(escaped, REPO_ROOT),
    ).toBe(true);
  });

  /* 10. protected binding path unreachable */
  it('rejects resolution into protected binding path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../mlb-prospective-holdout-game-identity-bindings/binding.json',
      ),
    ).toThrow();
    const escaped = path.resolve(
      REPO_ROOT,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      '../mlb-prospective-holdout-game-identity-bindings/binding.json',
    );
    expect(
      isWithinProtectedScientificPath(escaped, REPO_ROOT),
    ).toBe(true);
  });

  /* 11. scheduler-runtime path unreachable */
  it('rejects resolution into protected scheduler-runtime path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../mlb-prospective-holdout-scheduler-runtime/runtime.json',
      ),
    ).toThrow();
    const escaped = path.resolve(
      REPO_ROOT,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      '../mlb-prospective-holdout-scheduler-runtime/runtime.json',
    );
    expect(
      isWithinProtectedScientificPath(escaped, REPO_ROOT),
    ).toBe(true);
  });

  /* 12. ledger path unreachable */
  it('rejects resolution into protected ledger path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../mlb-inner-development-campaign-ledger/ledger.json',
      ),
    ).toThrow();
    const escaped = path.resolve(
      REPO_ROOT,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      '../mlb-inner-development-campaign-ledger/ledger.json',
    );
    expect(
      isWithinProtectedScientificPath(escaped, REPO_ROOT),
    ).toBe(true);
  });

  /* 13. TRAIN path unreachable */
  it('rejects resolution into protected TRAIN (inner-development) path', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath(
        REPO_ROOT,
        '../../../data/mlb/inner-development/mlb-inner-development-train-artifact-v1.json',
      ),
    ).toThrow();
    const escaped = path.resolve(
      REPO_ROOT,
      MLB_SHADOW_MONITORING_NAMESPACE_ROOT,
      '../../../data/mlb/inner-development/mlb-inner-development-train-artifact-v1.json',
    );
    expect(
      isWithinProtectedScientificPath(escaped, REPO_ROOT),
    ).toBe(true);
  });

  /* 14. resolver itself creates no directories/files */
  it('does not create directories or files when resolving paths', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'shadow-namespace-test-'),
    );
    try {
      resolveShadowMonitoringOperationalPath(tempRoot);
      resolveShadowMonitoringQuarantinePredictionsPath(tempRoot);
      resolveShadowMonitoringQuarantineOutcomesPath(tempRoot);
      resolveShadowMonitoringQuarantineGradingPath(tempRoot);

      // No mlb-shadow-monitoring directory should have been created.
      const shadowRoot = path.join(tempRoot, MLB_SHADOW_MONITORING_NAMESPACE_ROOT);
      await expect(fs.stat(shadowRoot)).rejects.toThrow();
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects non-absolute repository root', () => {
    expect(() =>
      resolveShadowMonitoringNamespacePath('relative/path', 'operational'),
    ).toThrow();
  });

  it('accepts valid relative path within namespace', () => {
    const result = resolveShadowMonitoringNamespacePath(REPO_ROOT, 'operational/2024-06-15.json');
    expect(result.resolved).toBe(
      path.join(REPO_ROOT, MLB_SHADOW_MONITORING_NAMESPACE_ROOT, 'operational/2024-06-15.json'),
    );
  });

  it('lists all protected paths for verification', () => {
    expect(PROTECTED.length).toBeGreaterThan(0);
    for (const p of MLB_SHADOW_MONITORING_PROTECTED_PATHS) {
      expect(p).toContain('mlb');
    }
  });
});
