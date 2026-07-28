# MLB Report Preview API Handler Validation Coverage

## Phase 6D status

Phase 6D adds golden-free validation coverage for the local MLB reportPreview API handler.
It strengthens tests around handler behavior without adding or changing goldens.

## Safety envelope

Phase 6D adds handler validation tests and documentation only.
It adds no real server.
It adds no HTTP routes.
It adds no Express/Fastify/Next/etc.
It adds no frontend framework files.
It adds no backend infrastructure.
It adds no database code.
It adds no deployment files.
It adds no file output.
It adds no CLI flags.
It adds no CLI behavior changes.
It adds no stdout golden.
It adds no fixtures.
It adds no generated export/review/prospective artifacts.
It modifies no existing goldens.

It preserves Phase 5B/5E/5H/5K/5N/5T/5Z goldens.
It preserves Phase 5Y report-preview CLI behavior.
It preserves Phase 6C handler contract and hardens invalid-input handling only if needed.
It preserves Phase 6B API contract behavior unless explicitly documented.
It preserves Phase 5W adapter behavior.
It preserves Phase 5X renderer behavior.

No modelProbability.
No picks/predictions/betting advice.
No raw outcomes.
No pitcher evidence.
No actual starters.
No live/API/web or network standings/roster/schedule ingestion.
No historical fixture changes.

## Coverage added

Handler validation tests now cover:

1. Raw research package shaped input rejection
   - package, researchPackageVersion, researchRunId, sourceConstructionRunId, constructionWarnings
   - Expected: PROHIBITED_FIELD

2. Raw historical fixture shaped input rejection
   - evidence, inputSnapshot, constructionVersion, lockVersion
   - Expected: PROHIBITED_FIELD

3. Betting/market fields as object keys rejection
   - odds, sportsbook, market, price, edge, ROI
   - Expected: PROHIBITED_FIELD

4. Betting/market terms in unsafe strings rejection
   - "market edge", "sportsbook price", "implied probability"
   - Expected: PROHIBITED_VALUE_TEXT

5. Exact known safe renderer safety note
   - "No live schedule, odds, pitcher, or market data is included."
   - Expected: PASS

6. Near-miss unsafe safety text rejection
   - "No live schedule, odds, pitcher, or market data is included, but this is a best bet."
   - Expected: PROHIBITED_VALUE_TEXT

7. Deterministic failure responses
   - Same invalid request twice produces deep-equal result.

8. Deterministic and local failure metadata
   - generatedAt null, source local-report-preview, deterministic true
   - contractVersion and handlerVersion match constants

9. Success metadata mirrors rendered report
   - rendererVersion, adapterVersion, generatedAt null, deterministic true

10. No mutation of deeply nested invalid input
    - Handler reads but does not modify input.

11. No file reads/writes, CLI invocations, or current time calls
    - Observable behavior verified via null generatedAt and golden pass.

12. Invalid source rejection
    - source: "live" (or any non-local-report-preview) returns INVALID_SOURCE

13. Non-object request rejection
    - null, undefined, string passed as any return structured INVALID_REQUEST
    - No throw for these invalid inputs.

## Phase 6D hardening

Two tiny handler hardening changes were made to satisfy coverage requirements:

- Non-object request guard: if `request` is null/undefined/string, return ok false with code `INVALID_REQUEST` instead of throwing.
- Source validation guard: if `request.source` is provided and not `'local-report-preview'`, return ok false with code `INVALID_SOURCE`.

These changes make the local handler more robust without changing normal happy-path behavior.

## Recommended next safe phase

Phase 6E — plan website UI component boundaries for consuming handler output only, no implementation.
Or next sport module planning if the user chooses.

Scope for Phase 6E:
- local-only planning
- no server/network
- no frontend implementation artifacts
- no real schedule ingestion
- no golden changes
- no CLI changes
- no file output
- no modelProbability
- no picks/predictions/betting advice
- no raw outcomes
- no pitcher evidence
- no actual starters
