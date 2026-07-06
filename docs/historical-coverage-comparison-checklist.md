# Historical Coverage Comparison Checklist

A conservative checklist for comparing fixture-only historical coverage runs before moving to broader historical windows.

This is an operational and data-coverage checklist. It does not prove model quality, evaluate predictive performance, or authorize larger historical windows. It is intended to keep coverage comparisons reproducible and leakage-safe.

## Purpose

Use this checklist before promoting fixture-only coverage runs to larger historical windows. Each new fixture-only run should be compared against the established smoke01 and small01 baseline, or a later documented baseline.

This checklist documents inputs, construction, evidence domains, warnings, abstentions, review validity, and artifact handling. It does not claim that observed coverage metrics predict real-world outcomes, model calibration success, or betting profitability.

## Source documents

Compare runs against these documents:

- docs/historical-coverage-run-log-smoke01.md
- docs/historical-coverage-run-log-small01.md
- docs/historical-coverage-observer-comparison-smoke01-small01.md
- docs/historical-coverage-artifact-naming.md
- docs/historical-dataset-coverage-plan.md

## Baseline comparison values

Use smoke01 vs small01 as the baseline example:

- requested dates: 7 -> 14
- predictions: 4 -> 7
- abstentions: 6 -> 13
- warnings: 16 -> 31
- prediction rate: 0.57 -> 0.50
- abstention rate: 0.86 -> 0.93
- warning rate: 2.29 -> 2.21
- evidence included remained stable: home-park, rest-travel, team-offense
- evidence excluded remained stable: bullpen, injuries-lineup, offense-lineup, opponent-batting, starting-pitcher, weather-roof
- comparisonIncluded remained true
- BOTH construction remained stable
- generated artifacts remained uncommitted

## Checklist sections

### 1. Preflight safety

- [ ] git status is clean before planning or executing any new run.
- [ ] expected branch is checked out and documented.
- [ ] expected HEAD is recorded, or the current HEAD is explicitly documented with reason.
- [ ] no unrelated files are present in the working tree.
- [ ] no live source authorization is in effect for the work.
- [ ] no package, script, or code changes are made unless explicitly scoped and authorized.

### 2. Source and data safety

- [ ] source mode is `fixture` only for this comparison.
- [ ] no real MLB API calls are made during the run.
- [ ] `source=live` is not requested, intended, or authorized.
- [ ] schedule probable starters are not retrospectively promoted.
- [ ] actual starters remain evaluation-only and are not treated as prospective inputs for TEAM_ONLY.
- [ ] `modelProbability` remains absent, null, or not available until calibration is separately authorized.

### 3. Construction safety

- [ ] research construction mode is explicitly recorded in the run log.
- [ ] BOTH comparison remains included when expected.
- [ ] TEAM_ONLY remains team-only and excludes pitcher evidence.
- [ ] FULL vs TEAM_ONLY is not interpreted as a predictive-performance comparison.
- [ ] construction stability is documented against the baseline.

### 4. Evidence-domain stability

- [ ] included evidence domains are listed and compared.
- [ ] excluded evidence domains are listed and compared.
- [ ] any new included or excluded domain is documented with rationale.
- [ ] missing domains are treated as coverage or data-quality signals, not model-quality claims.

### 5. Warning and abstention stability

- [ ] warning count and rate are compared against baseline.
- [ ] abstention count and rate are compared against baseline.
- [ ] new warning types are documented.
- [ ] recurring warning types are documented.
- [ ] wording changes that affect interpretation are documented.
- [ ] feature-coverage warnings are treated conservatively.

### 6. Review validation

- [ ] review commands pass before treating a run as reviewable.
- [ ] JSON and text review outputs are consistent when both are produced.
- [ ] threshold preset behavior remains documented.
- [ ] review failures stop promotion to larger windows.

### 7. Artifact handling

- [ ] generated temporary artifacts are not committed by default.
- [ ] artifact paths follow docs/historical-coverage-artifact-naming.md.
- [ ] committed docs summarize the run instead of committing bulky generated exports.
- [ ] if an artifact must be retained, the reason is explicit.

### 8. Promotion gate

A broader fixture-only window may be considered only when all of the following are satisfied:

- [ ] source remains `fixture`.
- [ ] no live or API usage occurs.
- [ ] construction and comparison are recorded.
- [ ] included and excluded evidence domains are understood.
- [ ] warning and abstention changes are explained.
- [ ] review validation passes.
- [ ] artifacts are handled safely.
- [ ] no model-quality or betting-style claims are introduced.

### 9. Stop conditions

Halt and rerun preflight if any of the following appear:

- [ ] dirty git status before starting the new run.
- [ ] unexpected HEAD, branch, or remote mismatch.
- [ ] live source accidentally requested.
- [ ] real API request attempted.
- [ ] `modelProbability` populated unexpectedly.
- [ ] new odds, market, betting, or implied-probability language appears.
- [ ] generated export or review artifact staged accidentally.
- [ ] schedule probable timestamp safety weakened.
- [ ] TEAM_ONLY accidentally includes pitcher evidence.
- [ ] review validation fails.

### 10. Decision template

Copy and complete this template for each comparison run.

```markdown
- Run label:
- Source:
- Window:
- Construction:
- Baseline compared against:
- Prediction count:
- Abstention count:
- Warning count:
- Prediction rate:
- Abstention rate:
- Warning rate:
- Evidence included changes:
- Evidence excluded changes:
- New warnings:
- Review validation result:
- Artifact handling:
- Decision: hold / repeat / expand fixture window
- Rationale:
- Sign-off:
```

### 11. Recommended next safe actions

- Use this checklist for the next fixture-only run planning step.
- Keep the next expansion conservative.
- Prefer documentation and reviewability before any larger historical scale-up.
- Continue avoiding live or API usage until explicitly authorized.
