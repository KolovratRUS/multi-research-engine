# MLB V1 Train-Only Inner-Development Campaign Ledger Plan

## 1. Locked baseline

Locked baseline: e23028c8953df8d0b3fb46cd0fbe4e53eac5293e
Commit: Implement MLB inner candidate ranking

## 2. Purpose

This document plans the durable persistence and execution-lifecycle contract for the
mlb-v1-train-only-inner-development-cycle-v1 TRAIN-only development campaign.

The pure E3-E budget API (recordInnerCandidateRecipeExecution, rankInnerEligibleCandidates)
deliberately provides no persistence. It cannot prove that a caller supplied the latest
historical ledger. Therefore the real campaign requires ONE canonical persisted cycle ledger
that:

- survives process exit;
- survives Hermes/chat/session boundaries;
- cannot be silently reset with the same cycleId;
- records all successfully registered distinct recipes;
- preserves slots consumed by incomplete/crashed/rejected candidates;
- preserves evaluationCount across exact reruns;
- can be safely resumed;
- can detect stale/incorrect/corrupted state;
- makes the 12-recipe development cap auditable.

This phase is PLANNING ONLY. No implementation. No candidate recipes. No trainer invocation.

## 3. Authoritative frozen prerequisites

Recovered from frozen source and docs:

- MLB_INNER_DEVELOPMENT_CYCLE_ID = mlb-v1-train-only-inner-development-cycle-v1
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts line 29)
- MLBInnerCandidateRecipe type with candidateRecipeId, preprocessingPolicyId, featurePolicyId,
  modelFamilyId, regularizationConfig, optimizerConfig, otherModelAffectingChoices, complexityRank
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 293-302)
- MLBInnerDevelopmentRecipeBudget type with contractVersion, cycleId, maxDistinctRecipes=12,
  seenRecipeIds, seenRecipeFingerprints, seenComplexityRanks, evaluationCount
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 324-332)
- recordInnerCandidateRecipeExecution: slot consumed at registration (evaluationCount +1,
  arrays grow). Exact rerun (same candidateRecipeId + same fingerprint + same complexityRank)
  increments evaluationCount only, does not grow distinct arrays.
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 3046-3155)
- computeMLBInnerCandidateRecipeFingerprint: SHA256 of canonical JSON of model-affecting fields
  only (preprocessingPolicyId, featurePolicyId, modelFamilyId, regularizationConfig,
  optimizerConfig, otherModelAffectingChoices). Runtime metadata (timestamp, PID, hostname)
  does NOT participate in fingerprint.
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 3031-3044)
- rankInnerEligibleCandidates: requires budget + registered recipe + matching fingerprint +
  matching complexityRank. Unregistered recipe -> UNREGISTERED_RECIPE.
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 3157-3342+)
- 12-slot registration timing: "A new distinct recipe consumes its ONE slot when it is
  successfully REGISTERED for execution, immediately BEFORE any inner-fold prediction/evaluation
  for that recipe is allowed to begin."
  (docs/mlb-v1-train-only-inner-development-evaluator-implementation-plan.md lines 899-920)
- exact-rerun semantics: same candidateRecipeId + same canonical fingerprint + same
  complexityRank -> distinct count unchanged, evaluationCount +1.
  (docs/mlb-v1-train-only-inner-development-evaluator-implementation-plan.md lines 921-954)
- identity alias conflict: same fingerprint, different candidateRecipeId -> IDENTITY_ALIAS_CONFLICT.
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 3111-3123)
- identity mutation conflict: same candidateRecipeId, different fingerprint -> IDENTITY_MUTATION_CONFLICT.
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 3098-3109)
- complexity-rank immutability: same id + same fingerprint but different complexityRank ->
  COMPLEXITY_RANK_MISMATCH. No state change.
  (src/prediction/mlb/mlb-train-only-inner-development-evaluator.ts lines 3071-3082)
- same-cycle reset prohibition: "after any candidate registration exists: the same cycle must
  NEVER be re-genesis'd automatically." No mechanism in pure E3-E API to prove latest ledger.
- persistence limitation: pure E3-E budget API is in-memory only.

Required explicit answers:

CURRENT_CYCLE_ID = mlb-v1-train-only-inner-development-cycle-v1
MAX_DISTINCT_RECIPES = 12
SLOT_CONSUMED_WHEN = successful registration, before any fold execution begins
EXACT_RERUN_NEW_SLOT = NO
SAME_CYCLE_EMPTY_RESET_ALLOWED = NO
PURE_E3_E_API_CAN_PROVE_LATEST_LEDGER = NO

## 4. Canonical persistence location

Chosen canonical location:

CANONICAL_LEDGER_LOCATION = var/mlb-development/mlb-inner-development-campaign-ledger/
CANONICAL_LEDGER_FILENAME = mlb-v1-train-only-inner-development-cycle-v1-ledger.json
PERSISTED_IN_GIT = NO
EPHEMERAL_TMP_STORAGE = NO

Justification:

- The repository currently ignores tmp/ and temp/ in .gitignore but has no var/ convention yet.
- var/ is the standard repository-local runtime-state root (analogous to /var in Unix).
- var/mlb-development/ isolates MLB research runtime state from other potential runtime state.
- var/mlb-development/mlb-inner-development-campaign-ledger/ makes the purpose explicit.
- This location is relative to the repository root, deterministic, and easy to inspect.
- It is NOT under /tmp, so it survives terminal/Hermes/chat/session boundaries.
- It is NOT an absolute user path, so it remains repository-portable.
- It is NOT committed to Git (mutable campaign state).

Future .gitignore entry to be added in E4-B2 or equivalent:

    var/mlb-development/

## 5. Ledger schema

### 5.1 Ledger envelope

File: mlb-v1-train-only-inner-development-cycle-v1-ledger.json

Top-level structure:

    {
      "ledgerContractVersion": "mlb-inner-development-campaign-ledger-v1",
      "developmentCycleId": "mlb-v1-train-only-inner-development-cycle-v1",
      "createdAt": "<ISO-8601 UTC>",
      "updatedAt": "<ISO-8601 UTC>",
      "budget": { ... },
      "registeredRecipes": [ ... ],
      "attempts": [ ... ]
    }

ledgerContractVersion: exact literal 'mlb-inner-development-campaign-ledger-v1'.
developmentCycleId: exact literal MLB_INNER_DEVELOPMENT_CYCLE_ID.
createdAt: ISO-8601 UTC timestamp of genesis.
updatedAt: ISO-8601 UTC timestamp of last successful mutation.

### 5.2 Budget block (mirrors pure API, plus contract version)

    {
      "contractVersion": "mlb-inner-development-recipe-budget-v1",
      "cycleId": "mlb-v1-train-only-inner-development-cycle-v1",
      "maxDistinctRecipes": 12,
      "seenRecipeIds": [],
      "seenRecipeFingerprints": [],
      "seenComplexityRanks": [],
      "evaluationCount": 0
    }

This mirrors the pure MLBInnerDevelopmentRecipeBudget type exactly so that pure validation
and transition logic can operate on a deserialized view.

### 5.3 Registered recipe descriptor (immutable after registration)

For each distinct successfully registered recipe, persist one entry in registeredRecipes:

    {
      "candidateRecipeId": "<string>",
      "registrationSequence": <integer starting at 1>,
      "registrationTimestamp": "<ISO-8601 UTC>",
      "recipeFingerprint": "<64-char lowercase hex sha256>",
      "complexityRank": <positive integer>,
      "preprocessingPolicyId": "<string>",
      "featurePolicyId": "<string>",
      "modelFamilyId": "<string>",
      "regularizationConfig": <JSON value>,
      "optimizerConfig": <JSON value>,
      "otherModelAffectingChoices": <JSON value>
    }

registrationSequence is monotonically increasing (1, 2, 3, ...). It never changes.

The full recipe descriptor is persisted so that human audit/recovery can reconstruct the
fingerprint without the original in-memory object.

PERSIST_FULL_RECIPE_DESCRIPTOR = YES
RECOMPUTE_FINGERPRINT_ON_LOAD = YES
RECIPE_DESCRIPTOR_MUTABLE_AFTER_REGISTRATION = NO

### 5.4 Attempt record

For every execution attempt (first attempt, exact rerun, failed run, etc.), persist one
entry in attempts:

    {
      "attemptNumber": <integer starting at 1 per candidate>,
      "candidateRecipeId": "<string>",
      "recipeFingerprint": "<64-char lowercase hex sha256>",
      "complexityRank": <positive integer>,
      "status": "<string enum>",
      "attemptTimestamp": "<ISO-8601 UTC>",
      "foldIds": [ "<string>", ... ]   // exactly 4 canonical fold IDs for this attempt
    }

Status values are defined in Section 7.

attemptNumber is per-candidate. The first execution of candidate X is attempt 1. An exact
rerun of X is attempt 2.

foldIds records which four canonical folds this attempt covered. This links the attempt to
the canonical fold plan without embedding fold definitions in every record.

### 5.5 Separate attempt artifact directory

Candidate attempt outputs (per-fold predictions, aggregate metrics, E3-D gate result, etc.)
live in a separate directory referenced by the ledger:

var/mlb-development/mlb-inner-development-campaign-artifacts/

This keeps the ledger compact and crash-safe. The ledger never contains large prediction
arrays.

Artifact file naming:

    <candidateRecipeId>--v<attemptNumber>--<recipeFingerprint>.json

Example:

    recipe-l2-l2-p05--v1--a1b2c3d4e5f6... .json

On load, the ledger reconciles that each referenced attempt artifact is present and its
content hash matches the recorded fingerprint.

## 6. Registration transaction boundary

Crash-safe ordering for a new distinct candidate:

1. acquire exclusive campaign lock
2. load current canonical ledger (or detect missing + genesis state)
3. validate ledger integrity (Section 12)
4. validate current cycle matches MLB_INNER_DEVELOPMENT_CYCLE_ID
5. validate budget has remaining distinct slots
6. validate candidate recipe (type + fields)
7. compute fingerprint from canonical recipe descriptor
8. call pure recordInnerCandidateRecipeExecution transition (pure in-memory check)
9. if transition fails (alias, mutation, budget exhausted): release lock, return error
10. if transition succeeds: atomically persist new full ledger (Section 9)
11. fsync / rename durability boundary
12. release lock
13. only AFTER successful durable persistence may fold execution begin

FOLD_EXECUTION_BEFORE_DURABLE_REGISTRATION = NO
SLOT_DURABLY_RECORDED_BEFORE_EXECUTION = YES

This prevents a crash from allowing a free unrecorded candidate probe.

## 7. Attempt / status lifecycle

Status values (exact names frozen):

- REGISTERED
  - Distinct slot has been durably consumed. No fold execution has begun yet.
- RUNNING
  - Fold execution is in progress.
- COMPLETED_INNER_ELIGIBLE
  - All folds completed; E3-D strict gate returned INNER_ELIGIBLE.
- COMPLETED_INNER_REJECTED
  - All folds completed; E3-D strict gate returned INNER_REJECTED.
- FAILED
  - Execution crashed or produced unrecoverable invalid fold outputs.
- INTERRUPTED
  - Process was terminated before completion (e.g., SIGKILL, timeout, OOM).

Critical invariants:

- REGISTERED already means the distinct slot has been consumed.
- No later state may refund that slot.
- A candidate may move from REGISTERED -> RUNNING -> (COMPLETED_* | FAILED | INTERRUPTED).
- Once COMPLETED_* or terminal state is reached, it does not revert.

Required answers:

FAILED_REFUNDS_SLOT = NO
INTERRUPTED_REFUNDS_SLOT = NO
INNER_REJECTED_REFUNDS_SLOT = NO

## 8. Atomic write strategy

Crash-safe local write strategy for the canonical ledger:

1. serialize new full ledger object to JSON (sorted keys, 2-space indent for auditability)
2. write sibling temporary file in the same directory:
   .mlb-v1-train-only-inner-development-cycle-v1-ledger.json.tmp
3. fsync the temporary file descriptor if supported/practical
4. atomically rename temporary file over the canonical ledger filename
5. fsync the containing directory if supported/practical

If atomic replacement fails at any step: the previous known-good canonical ledger is
untouched. The operation returns an error. No partial overwrite.

If the temporary file already exists from a prior failed write, it is removed before
creating a new one.

IN_PLACE_TRUNCATE_AND_REWRITE = NO
ATOMIC_REPLACEMENT_REQUIRED = YES

## 9. Concurrency / single-writer protection

Two simultaneous campaign processes must not both load 11/12 and independently register
a "12th" recipe.

Strategy: exclusive lock directory using atomic filesystem creation.

Lock location:

var/mlb-development/mlb-inner-development-campaign-ledger/.lock

Acquisition behavior:

- attempt atomic mkdir of the lock directory
- if mkdir succeeds: lock acquired
- if mkdir fails with EEXIST: another writer holds the lock; fail closed with clear error

Stale-lock handling:

- the lock directory is runtime metadata only; it does not contain recipe identity
- if ownership cannot be safely proved (process no longer running, or no PID evidence),
  fail closed and require manual review
- LOCK_METADATA_AFFECTS_RECIPE_FINGERPRINT = NO

Release behavior:

- on normal completion: rmdir the lock directory
- on abnormal termination (SIGKILL, crash): the lock directory may remain; manual review
  required to prove ownership before removal

Failure behavior:

- if lock cannot be acquired: abort registration before any budget mutation
- do not wait/retry/rotate; fail fast

Required answers:

CONCURRENT_WRITERS_ALLOWED = NO
REGISTRATION_REQUIRES_EXCLUSIVE_LOCK = YES

## 10. Ledger integrity validation

On every load, validate ALL of the following. No silent repair.

- ledgerContractVersion === 'mlb-inner-development-campaign-ledger-v1' exactly
- developmentCycleId === 'mlb-v1-train-only-inner-development-cycle-v1' exactly
- budget.contractVersion === 'mlb-inner-development-recipe-budget-v1' exactly
- budget.cycleId === 'mlb-v1-train-only-inner-development-cycle-v1' exactly
- budget.maxDistinctRecipes === 12
- budget.seenRecipeIds.length === budget.seenRecipeFingerprints.length === budget.seenComplexityRanks.length
- budget.seenRecipeIds contains unique non-empty strings
- budget.seenRecipeFingerprints contains unique lowercase 64-char hex strings
- budget.seenComplexityRanks contains positive integers
- budget.evaluationCount >= budget.seenRecipeIds.length
- registeredRecipes.length === budget.seenRecipeIds.length
- every registeredRecipes[].candidateRecipeId matches budget.seenRecipeIds at same index
- every registeredRecipes[].recipeFingerprint matches budget.seenRecipeFingerprints at same index
- every registeredRecipes[].complexityRank matches budget.seenComplexityRanks at same index
- every registeredRecipes[].registrationSequence is unique and ranges 1..N
- every attempt.candidateRecipeId exists in budget.seenRecipeIds
- every attempt.recipeFingerprint matches the registered recipe fingerprint
- every attempt.complexityRank matches the registered complexityRank
- every attempt.status is one of the valid status enum values
- attempt timestamps are parseable ISO-8601 UTC
- no candidate exists in attempts without a corresponding registration
- no duplicate registrationSequence

CORRUPT_LEDGER_BEHAVIOR = FAIL_CLOSED
AUTO_REPAIR_CORRUPT_LEDGER = NO

## 11. Ledger genesis

### 11.1 First genesis

A canonical empty ledger may be created exactly once for the cycle BEFORE candidate 1.

Genesis produces:

    {
      "ledgerContractVersion": "mlb-inner-development-campaign-ledger-v1",
      "developmentCycleId": "mlb-v1-train-only-inner-development-cycle-v1",
      "createdAt": "<genesis timestamp>",
      "updatedAt": "<genesis timestamp>",
      "budget": {
        "contractVersion": "mlb-inner-development-recipe-budget-v1",
        "cycleId": "mlb-v1-train-only-inner-development-cycle-v1",
        "maxDistinctRecipes": 12,
        "seenRecipeIds": [],
        "seenRecipeFingerprints": [],
        "seenComplexityRanks": [],
        "evaluationCount": 0
      },
      "registeredRecipes": [],
      "attempts": []
    }

After any candidate registration exists: the same cycle must NEVER be re-genesis'd
automatically.

FIRST_GENESIS_ALLOWED = YES
GENESIS_AFTER_DEVELOPMENT_STARTED = NO
MISSING_LEDGER_AFTER_DEVELOPMENT_STARTED = FAIL_CLOSED

### 11.2 Reset-prevention anchor

A local ledger file being absent cannot distinguish:

- "campaign never started"
- "ledger accidentally deleted"

The plan freezes ONE durable genesis marker / campaign manifest as the reset-prevention
anchor:

RESET_PREVENTION_ANCHOR = committed immutable genesis marker file at
docs/mlb-v1-train-only-inner-development-campaign-marker.md

The marker is committed to Git and contains:

- locked baseline commit hash
- current cycle ID
- genesis timestamp
- statement that mutable campaign state follows in var/mlb-development/...

The marker is created exactly once when the first ledger is genesis'd. It is never mutated.

If the marker exists but the ledger is missing: LEDGER_MISSING_WITH_EXISTING_ANCHOR = FAIL_CLOSED.
Do not silently create a fresh empty ledger.

Tradeoff:

- Committed marker: visible in Git history, easy to audit, survives clone.
- Runtime-persisted marker: would not survive a fresh clone, weaker guarantee.
- Chosen approach: committed marker, because this campaign is repository-scoped research
  infrastructure and the marker contains no mutable outcomes.

LEDGER_MISSING_WITH_EXISTING_ANCHOR = FAIL_CLOSED

## 12. Backups / recovery

The canonical ledger is a single source of truth. The strategy retains:

- the canonical ledger (current state)
- atomic rename guarantees that a failed write never destroys the previous good state
- the committed genesis marker (immutable, in Git)

No automatic rollback journal is required for the initial campaign. The atomic rename
strategy already prevents partial overwrite.

If multiple candidate ledger copies disagree (e.g., manual copy, external sync):

- fail closed unless monotonic/canonical recovery is provably safe
- automatic recovery must NEVER decrease:
  - distinct consumed slots
  - evaluationCount
  - any registration sequence
- any recovery that would decrease these values requires explicit manual forensic intervention

AUTOMATIC_RECOVERY_CAN_REDUCE_CONSUMED_SLOTS = NO
AUTOMATIC_RECOVERY_CAN_REDUCE_EVALUATION_COUNT = NO

## 13. Exact re-execution persistence

Exact deterministic rerun semantics (same candidateRecipeId + same fingerprint +
same complexityRank):

- distinct count delta = 0
- evaluationCount delta = +1
- a new attempt record is appended with incremented attemptNumber
- status of new attempt is set to REGISTERED, then RUNNING, then terminal state

EXACT_RERUN_DISTINCT_COUNT_DELTA = 0
EXACT_RERUN_EVALUATION_COUNT_DELTA = 1
EXACT_RERUN_NEW_ATTEMPT_RECORD = YES

## 14. 12th / 13th durable boundary

When 11 distinct slots are consumed:

- candidate 12 may be registered atomically (slot 12 becomes REGISTERED)

After 12 distinct slots are consumed:

- candidate 13 must be rejected BEFORE:
  - trainer invocation
  - fold execution
  - prediction generation
  - attempt execution
  - ledger state mutation
- the 13th candidate must not increment evaluationCount
- optional rejected-request audit metadata may be recorded OUTSIDE the budget block and
  OUTSIDE evaluationCount, clearly labeled as rejected-outside-budget

THIRTEENTH_RECIPE_TRAINER_INVOCATION = NO
THIRTEENTH_RECIPE_FOLD_EXECUTION = NO
THIRTEENTH_RECIPE_EVALUATION_COUNT_INCREMENT = NO

## 15. Separation between registration ledger and model outputs

The canonical campaign ledger is control/provenance state.

Fold predictions, metrics, and per-fold outputs live in SEPARATE immutable candidate-attempt
artifacts referenced by the ledger (Section 5.5).

The ledger never marks COMPLETED_* until the referenced candidate attempt artifact is
durably written and validated.

## 16. Candidate-attempt artifact provenance

Each candidate attempt artifact (e.g., recipe-l2-l2-p05--v1--a1b2c3d4e5f6....json) must
contain at minimum:

- developmentCycleId
- candidateRecipeId
- recipeFingerprint
- complexityRank
- attemptNumber
- four canonical fold IDs (foldIds)
- aggregate metrics (aggregateLogLoss, aggregateBrierScore, aggregateRocAuc)
- E3-D gate result (INNER_ELIGIBLE / INNER_REJECTED with deterministic reasons)
- timestamps/provenance (registrationTimestamp, attemptStartTimestamp, attemptEndTimestamp)
- contract versions (ledgerContractVersion, budgetContractVersion, foldPlanId)

Outer VALIDATION and TEST payloads remain absent.

## 17. Resume semantics

When the campaign runner starts:

1. acquire exclusive lock
2. locate/reset-prevention anchor (committed marker)
3. load canonical ledger
4. validate ledger integrity (Section 12)
5. reconcile attempt artifacts referenced by the ledger
6. identify incomplete/failed/interrupted candidate attempts
7. report campaign state
8. require explicit caller instruction before registering/executing another candidate

No automatic next recipe is invented merely because the runner resumed.

RESUME_AUTO_CREATES_NEW_RECIPE = NO
RESUME_AUTO_CONSUMES_SLOT = NO

## 18. Candidate execution authorization boundary

Even after the durable ledger is implemented:

real candidate execution must still require a separately reviewed campaign recipe plan.

This phase does NOT authorize candidate 1, candidate family, hyperparameter grid,
model family search, feature mutation, outer VALIDATION attempt, or TEST.

LEDGER_IMPLEMENTATION_ALONE_AUTHORIZES_REAL_CANDIDATE = NO
NEXT_REAL_FIT_AUTHORIZED = NO

## 19. Future orchestration API plan

Minimum future functions/modules required (names frozen as planned):

### Pure validation/transition (no IO)

- validateMLBInnerDevelopmentCampaignLedger(ledger: unknown) -> ValidationResult
- transitionMLBInnerDevelopmentRecipeBudget(budget, candidateRecipe) -> TransitionResult
  (wraps recordInnerCandidateRecipeExecution)

### Persistence/orchestration (IO)

- initializeMLBInnerDevelopmentCampaignLedger(cycleId) -> LedgerGenesisResult
- loadMLBInnerDevelopmentCampaignLedger(cycleId, anchor) -> LedgerLoadResult
- persistMLBInnerDevelopmentCampaignLedger(ledger) -> PersistResult
- acquireMLBInnerDevelopmentCampaignLock(lockPath) -> LockResult
- registerMLBInnerDevelopmentCandidate(candidateRecipe) -> RegistrationResult
- recordMLBInnerDevelopmentAttemptStatus(candidateRecipeId, status, foldIds) -> RecordResult
- completeMLBInnerDevelopmentAttempt(candidateRecipeId, artifactPath) -> CompleteResult
- resumeMLBInnerDevelopmentCampaign(cycleId) -> ResumeResult

Pure validation/transition logic is separated from filesystem persistence/orchestration.

Do NOT implement any function now.

## 20. Failure behavior table

| Scenario | Behavior | Manual Action |
|---|---|---|
| missing ledger before genesis | permit genesis | none |
| missing ledger after genesis anchor exists | FAIL_CLOSED | restore ledger or forensic review |
| corrupt ledger | FAIL_CLOSED | restore from known-good copy or review |
| wrong cycle ID | FAIL_CLOSED | verify correct cycle |
| unsupported contract version | FAIL_CLOSED | verify correct phase |
| fingerprint mismatch (registered vs recomputed) | FAIL_CLOSED | forensic review |
| complexity mismatch | FAIL_CLOSED | forensic review |
| duplicate recipe ID | FAIL_CLOSED | remove duplicate or review |
| duplicate fingerprint alias | FAIL_CLOSED | resolve alias conflict |
| 12 slots already consumed | reject candidate 13 before execution | none |
| lock already held | fail fast, abort | wait for lock release or review stale lock |
| stale lock uncertain | FAIL_CLOSED | manual review, prove ownership before lock removal |
| atomic write failure | preserve previous ledger | retry or review filesystem |
| attempt artifact missing | FAIL_CLOSED on load/resume | restore artifact or review |
| attempt artifact hash mismatch | FAIL_CLOSED | forensic review |
| interrupted candidate | record INTERRUPTED, slot remains consumed | resume or manually resolve |

No silent repair. No automatic rollback that decreases slots or evaluationCount.

## 21. No database assumption

This initial campaign is local/offline TRAIN-only research infrastructure.

Chosen mechanism: JSON files on local filesystem with atomic rename + exclusive lock directory.

This is:

- auditable (plain JSON, human-readable)
- atomic (rename-based replacement)
- recoverable (previous state untouched on write failure)
- deterministic (same inputs -> same file content)
- easy to inspect (no DB tooling required)
- easy to test (fixture JSON files)

Future production recommendation systems may use database-backed persistence later.
That does not imply this development ledger needs it now.

Database persistence is NOT required for this phase.

## 22. Git-ignore / runtime-state plan

The canonical ledger directory (var/mlb-development/mlb-inner-development-campaign-ledger/)
and artifact directory (var/mlb-development/mlb-inner-development-campaign-artifacts/)
must be ignored by Git.

Future .gitignore entry:

    var/mlb-development/

The immutable genesis/reset-prevention anchor (docs/mlb-v1-train-only-inner-development-campaign-marker.md)
is committed to Git because:

- it contains no mutable campaign outcomes
- it survives fresh clones
- it provides a Git-verifiable record that the campaign was initialized

Mutable state remains in var/mlb-development/ which is gitignored.

## 23. Auditability

The design enables a future reviewer to answer:

- How many distinct slots are consumed? -> budget.seenRecipeIds.length
- How many executions have occurred? -> budget.evaluationCount
- Which recipe IDs have been registered? -> budget.seenRecipeIds + registeredRecipes
- What is each recipe fingerprint? -> budget.seenRecipeFingerprints + registeredRecipes
- What complexity rank was frozen? -> budget.seenComplexityRanks + registeredRecipes
- Which attempts completed/rejected/failed/interrupted? -> attempts[].status
- Has recipe identity ever changed? -> recompute fingerprint from registered descriptor; compare
- Is the ledger from the correct development cycle? -> developmentCycleId exact match
- Was the ledger reset? -> committed marker + createdAt + registrationSequence monotonicity
- Is candidate 13 blocked? -> budget.seenRecipeIds.length >= 12 check

No dependence on terminal scrollback.

## 24. Expected future implementation slicing

E4-B1:
ledger/anchor schema + pure validation

- define TypeScript interfaces for ledger envelope, budget block, registered recipe,
  attempt record, attempt artifact
- implement validateMLBInnerDevelopmentCampaignLedger (pure)
- create committed genesis marker document
- unit tests for validation (valid ledger, corrupt ledger, wrong cycle, mismatched arrays)

E4-B2:
atomic persistence + lock + genesis/resume

- implement initializeMLBInnerDevelopmentCampaignLedger (atomic write + genesis marker check)
- implement loadMLBInnerDevelopmentCampaignLedger
- implement persistMLBInnerDevelopmentCampaignLedger (atomic rename + fsync)
- implement acquireMLBInnerDevelopmentCampaignLock (mkdir-based exclusive lock)
- implement resumeMLBInnerDevelopmentCampaign (load + validate + reconcile artifacts)
- unit tests for atomic write, lock, stale lock, genesis, resume

E4-B3:
candidate registration orchestration

- implement registerMLBInnerDevelopmentCandidate (lock -> validate -> transition -> persist -> release)
- integrate with pure recordInnerCandidateRecipeExecution
- enforce slot-consumed-before-execution boundary
- unit tests for registration, 12-slot exhaustion, alias/mutation/complexity conflicts,
  exact rerun (no new slot, evaluationCount+1)

E4-B4:
attempt artifact/status lifecycle

- implement recordMLBInnerDevelopmentAttemptStatus
- implement completeMLBInnerDevelopmentAttempt (artifact write + hash validation)
- define exact attempt artifact schema and write ordering
- unit tests for status transitions, artifact linkage, missing artifact, hash mismatch

E4-B5:
end-to-end synthetic crash/resume/integrity tests

- simulate crash after registration but before artifact write
- simulate concurrent writer contention
- simulate corrupt ledger on load
- simulate stale lock
- simulate 12-slot boundary + 13th rejection
- verify resume semantics (no auto-create, no auto-consume slot)

Then ONLY after all E4-Bx are reviewed/pushed:

- separate campaign-recipe planning phase (defines candidate 1 recipe family)

Then candidate 1.

Do not collapse everything into one implementation phase.

## 25. Required explicit non-authorization

NEXT_REAL_FIT_AUTHORIZED = NO
REAL_CANDIDATE_1_AUTHORIZED = NO
REAL_OUTER_VALIDATION_ATTEMPTS_AUTHORIZED = 0
TEST_AUTHORIZED = NO
V3_CONFIGURATION_CREATED = NO

## 26. External-event accounting

EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_R1 = readonly-audit/SKILL.md patched once
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_R2 = deterministic-contract-repair/SKILL.md patched once
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_I1 = 0
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_I2 = 0
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_I2_R1 = 0
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_I2_R1A = 0
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_I2_R1B = mlb-inner-development-evaluator/SKILL.md patched once
EXTERNAL_SELF_IMPROVEMENT_EVENTS_E3_E_I2_R1C = 0

EXTERNAL_SELF_IMPROVEMENT_EVENTS_THIS_E4_A = 0
