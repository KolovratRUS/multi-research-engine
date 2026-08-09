# MLB V1 Sport-Data Source Evaluation

## 1. Phase status

Phase 8C. Authorized source research only. No production API requests, no credentials, no ingestion, no persistence.

## 2. Locked baseline

7502d12f917e1763e8b4ea5f96f44f7cbced8371

## 3. Evaluation date

2026-07-31

## 4. Purpose

Evaluate current MLB sport-data source candidates by role, authority, coverage, and risk so that a future provider-neutral canonical pregame snapshot can be constructed from verified evidence. This document does not authorize production ingestion, hard-code a provider, or establish terms.

## 5. Permanent odds-blind boundary

The canonical pregame snapshot and all downstream prediction inputs must remain odds-blind. No selected source, adapter, or validator may introduce sportsbook odds, prices, market-implied probabilities, betting lines, payout information, Kelly calculations, model-generated probabilities, predicted winners, selections, multi construction, staking guidance, grading, or performance outcomes.

## 6. Evaluation method and classification key

Evidence states:

- OBSERVED REPOSITORY FACT — seen directly in the current repository code at baseline 7502d12.
- VERIFIED EXTERNAL FACT — confirmed by an official source or its documentation on 2026-07-31.
- INFERENCE — logical deduction from verified facts or repository evidence, explicitly labeled as such.
- RECOMMENDATION — a suggested direction that must still be validated before implementation.
- UNKNOWN — could not be verified from official sources as of 2026-07-31 and remains a blocker.

Official sources consulted with access date 2026-07-31:

1. MLB Stats API portal — https://statsapi.mlb.com/ — VERIFIED EXTERNAL FACT.
2. MLB Stats API Documentation — https://docs.statsapi.mlb.com/ — VERIFIED EXTERNAL FACT (presented behind Okta login as of access date).
3. MLB Terms of Use — https://www.mlb.com/official-information/terms-of-use — VERIFIED EXTERNAL FACT.
4. Retrosheet — https://www.retrosheet.org/ and https://www.retrosheet.org/notice.txt — VERIFIED EXTERNAL FACT.
5. Sports Reference Terms of Use — https://www.sports-reference.com/termsofuse.html — VERIFIED EXTERNAL FACT.
6. FanGraphs Terms of Service — https://www.fangraphs.com/about/terms-of-service — VERIFIED EXTERNAL FACT.
7. Baseball Savant CSV documentation — https://baseballsavant.mlb.com/csv-docs — VERIFIED EXTERNAL FACT.
8. Repository source files under src/lib/research-data/mlb and src/lib/backtesting/mlb — OBSERVED REPOSITORY FACT.

No official MLB Stats API authentication, rate-limit, or commercial-license page was publicly accessible as of 2026-07-31 without Okta registration. Facts not available from these sources are labeled UNKNOWN.

## 7. Existing repository source/provider inventory

### 7.1 production-ready

None inside src/prediction. The prediction layer currently contains only the Phase 8B firewall and MLB prediction contract; it has no network, filesystem, environment, or data-provider access.

### 7.2 exploratory

`src/lib/research-data/mlb/stats-api-client.ts` — OBSERVED REPOSITORY FACT. Implements a live MLB Stats API client using endpoints `/schedule`, `/game/{gamePk}/feed/live`, `/people/{personId}/stats`, `/teams/{teamId}/stats`, `/venues/{venueId}`. Uses `fetch`, Zod schemas, retries, timeout, and `MLB_STATS_API_BASE_URL` / `RESEARCH_HTTP_TIMEOUT_MS` env configuration. Cannot be reused inside src/prediction without breaking the provider-neutral boundary.

`src/lib/research-data/mlb/provider.ts` — OBSERVED REPOSITORY FACT. Implements `MLBResearchDataAdapter` that uses the live client to build a research snapshot with weather, probable pitchers, team stats, bullpen, and venue. Uses `new Date()` for fetched timestamps and staleness checks.

### 7.3 local-only

`src/lib/backtesting/mlb/snapshot-builder.ts` — OBSERVED REPOSITORY FACT. Builds a deep-frozen backtest snapshot from cloned objects and a deterministic timestamp. No network or env access.

`src/lib/backtesting/mlb/feature-extractor.ts` — OBSERVED REPOSITORY FACT. Derives `MLBPregameFeatures` from historical profiles and game state.

### 7.4 live-capable

`src/lib/research-data/mlb/stats-api-client.ts` is live-capable. `src/lib/backtesting/mlb/live-history/schedule-loader.ts` is live-capable via `MLBHistoricalHttpClient`.

### 7.5 imports provider-specific types

The exploratory `src/lib/research-data/mlb/provider.ts` imports `MLBGameResearchSnapshot`, `PitcherAssignment`, `DataProvenance`, `MLBVenue`, `MLBScheduleGame`, and many others from `src/lib/research-data/types.ts`. The backtesting module imports historical types and canonical types.

### 7.6 has point-in-time protections

`src/lib/backtesting/mlb/live-history/provider.ts` — OBSERVED REPOSITORY FACT. Uses cutoff dates, `fetchRecentGamesBefore` with strict cutoff/limit, and `asOf` timestamps. Pitcher capture blocks retrospective writes.

### 7.7 lacks source timestamps

`src/lib/backtesting/mlb/live-history/schedule-loader.ts` — OBSERVED REPOSITORY FACT. Sets `sourceTimestamp: null` on cached schedule provenance. Schedule probable pitcher IDs do not carry pre-cutoff proof timestamps.

### 7.8 cannot be reused directly inside src/prediction

The exploratory modules import provider-specific schema types, env helpers, network clients, live fidelity flags, research-specific completeness, and legacy odds/candidate/multi types. They are not JSON-neutral and are disallowed imports under Phase 8C.

## 8. Canonical source requirements

A canonical pregame snapshot source role must satisfy:

1. Authority — official or explicitly licensed identity, schedule, and statistics for MLB games.
2. Stable identifiers — persistent game, team, player, and venue IDs usable before and after a game.
3. Pregame coverage — data available before first pitch with documented update cadence.
4. Historical coverage — point-in-time reconstruction capability for past game dates.
5. Source-updated timestamps — each section or reference must carry a trustable timestamp.
6. Correction/backfill behavior — documented whether the source revises prior data or only appends deltas.
7. Probable versus confirmed starter semantics — explicit distinction between announced probable and confirmed starters.
8. Lineup availability — pregame lineup data with card/roster status.
9. Doubleheader handling — official doubleheader game numbers 1 and 2.
10. Neutral-site handling — venue and site classification.
11. Postponement/rescheduling — explicit status with rescheduledFrom gamePk if available.
12. Schema stability — stable field names and types across seasons.
13. Authentication — whether API auth is required and at what cost.
14. Rate limits — documented request allowances.
15. Licensing — commercial-use and redistribution permissions explicitly stated by the source.
16. Provider-lock-in risk — whether a single source is the only practical access path.

## 9. Candidate source matrix

### 9.1 MLB Stats API

**Source title:** MLB Stats API
**Organization:** Major League Baseball
**Official URL:** https://statsapi.mlb.com/
**Accessed:** 2026-07-31
**Available roles:** official schedule and game identity; team and player identity; starting-pitcher information; team and pitcher statistics; venue and park context.
**Assessment:** SUPPORTED for schedule, probable pitchers, venue, team stats, and pitcher stats as observed in the repository and inferred from endpoint paths. Advanced hitting/pitching splits are present but Statcast-range metrics are not all confirmed in the examined endpoints. Historical depth and point-in-time behavior are UNKNOWN because the API documentation is not publicly accessible without Okta registration as of access date.
**Cited evidence:** `src/lib/research-data/mlb/stats-api-client.ts` lines 193-311 demonstrate live use of schedule, probable pitchers, season stats, game logs, team stats, venue, and boxscore/feed/live endpoints. docs.statsapi.mlb.com present but gated behind Okta login on 2026-07-31.

### 9.2 MLB Stats API — undocumented public usage

**Source title:** MLB Stats API undocumented public usage
**Organization:** Major League Baseball
**Official URL:** https://statsapi.mlb.com/
**Accessed:** 2026-07-31
**Available roles:** same as 9.1.
**Assessment:** UNKNOWN. Third-party community discussions suggest only individual, non-commercial, non-bulk use is permitted, but no official public terms page was accessible on 2026-07-31. Commercial-use and redistribution permissions must not be assumed.
**Cited evidence:** Reddit discussion r/mlbdata references license ambiguity; MLB official terms page does not explicitly grant data-scraping permissions.

### 9.3 Retrosheet

**Source title:** Retrosheet
**Organization:** Retrosheet
**Official URL:** https://www.retrosheet.org/
**Accessed:** 2026-07-31
**Available roles:** historical point-in-time reconstruction; historical team and player identity; historical game identity for regular season, All-Star, and postseason.
**Assessment:** SUPPORTED for historical game outcomes and play-by-play backfill. UNSUPPORTED for live pregame schedule, probable pitchers, lineups, and weather because Retrosheet publishes post-hoc data files, not a live API. Data coverage from 1910 onward with some gaps pre-1910 and a few missing games pre-1969 per verified notice text. Licensing explicitly permits commercial use and redistribution with attribution.
**Cited evidence:** Retrosheet notice text at https://www.retrosheet.org/notice.txt confirms commercial-use permission with attribution requirement. CSV and event file inventories from 1910-2025 verified on the site.

### 9.4 Baseball Savant / Statcast CSV

**Source title:** Baseball Savant Statcast CSV Downloads
**Organization:** Major League Baseball
**Official URL:** https://baseballsavant.mlb.com/csv-docs
**Accessed:** 2026-07-31
**Available roles:** advanced tracking metrics; pitch-level and game-level Statcast data; player-level percentile rankings.
**Assessment:** PARTIAL for advanced metrics. The CSV download interface is official and documented. Commercial-use and programmatic access terms are UNKNOWN because no explicit API license beyond manual CSV export is documented at the verified URL.
**Cited evidence:** https://baseballsavant.mlb.com/csv-docs confirms CSV columns and query scope. No programmatic API endpoint license found on that page.

### 9.5 FanGraphs

**Source title:** FanGraphs
**Organization:** FanGraphs
**Official URL:** https://www.fangraphs.com/about/terms-of-service
**Accessed:** 2026-07-31
**Available roles:** team statistics; pitcher statistics; projected and modeled metrics (excluded from snapshot); leaderboards.
**Assessment:** PARTIAL for sport-data display. FanGraphs terms explicitly prohibit reproduction, duplication, copying, sale, trade, resale, or commercial exploitation. Snapshot ingestion or redistribution is blocked by documented license.
**Cited evidence:** https://www.fangraphs.com/about/terms-of-service states explicit commercial-use prohibition.

### 9.6 Sports Reference / Baseball-Reference

**Source title:** Sports Reference Terms of Use
**Organization:** Sports Reference LLC
**Official URL:** https://www.sports-reference.com/termsofuse.html
**Accessed:** 2026-07-31
**Available roles:** historical box scores, standings, leaders, schedules.
**Assessment:** PARTIAL for historical reference. License is limited, personal, non-exclusive, non-sublicensable, non-assignable, non-transferable, and revocable. Commercial use and redistribution are not permitted.
**Cited evidence:** https://www.sports-reference.com/termsofuse.html section 5 and 19.

### 9.7 Sportradar MLB

**Source title:** Sportradar MLB API
**Organization:** Sportradar
**Official URL:** https://developer.sportradar.com/baseball/reference/mlb-overview
**Accessed:** 2026-07-31
**Available roles:** schedule, standings, team/player identities, statistics, venue context, odds.
**Assessment:** SUPPORTED in principle but UNKNOWN for cost, historical point-in-time depth, and exact schema. Commercial license requires a paid agreement. Odds feeds are bundled and must be excluded under the odds-blind firewall.
**Cited evidence:** Official developer portal overview as of 2026-07-31.

### 9.8 api-sports.io (RapidAPI)

**Source title:** API Sports Baseball
**Organization:** API Sports
**Official URL:** https://api-sports.io/documentation/baseball/v1
**Accessed:** 2026-07-31
**Available roles:** schedule, teams, players, statistics, standings.
**Assessment:** PARTIAL. Documentation is public. Licensing is unknown for bulk historical point-in-time reconstruction. Requires RapidAPI key. Rate limits are documented per endpoint.
**Cited evidence:** https://api-sports.io/documentation/baseball/v1 documents X-RateLimit-Limit and X-RateLimit-Remaining headers.

### 9.9 Weather providers

**Source title:** OpenWeather / WeatherAPI / NOAA
**Organization:** varies
**Official URLs:** https://openweathermap.org/, https://www.weatherapi.com/, https://www.noaa.gov/
**Accessed:** 2026-07-31
**Available roles:** venue weather context (temperature, precipitation, wind, humidity).
**Assessment:** NOT APPLICABLE for baseball identity or statistics. REQUIRED as a separate weather-only source role. Licensing and terms vary by provider; unspecified here because weather is a narrow, replaceable supplement.
**Cited evidence:** General knowledge of public weather API and data providers; no commercial-use claims are made.

## 10. Schedule and official game identity

MLB Stats API is the only observed live path to official MLB schedule and probable-pitcher hydration in the repository. The endpoint `/schedule?sportId=1&date=...&hydrate=probablePitcher,venue` is used in `src/lib/research-data/mlb/stats-api-client.ts`. Retrosheet lacks live schedule identity. Sports Reference, FanGraphs, and api-sports all provide schedule-like data but with unknown live pregame fidelity or commercial restrictions.

Recommendation: use MLB Stats API as the primary source for official game identity and schedule, provided licensing is resolved before production ingestion.

## 11. Team and player identity

MLB Stats API and Retrosheet both carry stable numeric IDs. FanGraphs uses its own ID namespace. Sports Reference uses slug-based identities. Mixing namespaces across providers creates identity reconciliation risk.

Recommendation: standardize on MLB Stats API numeric IDs in the canonical snapshot. Retrosheet may serve as a fallback for completed historical games when point-in-time license allows.

## 12. Starting pitchers

`src/lib/research-data/mlb/stats-api-client.ts` verifies that the MLB Stats API schedule response includes `probablePitcher` under each team block with `id` and `fullName`, and that `/game/{gamePk}/feed/live` can provide probable pitchers as a fallback.

Probable versus confirmed semantics:
- MLB schedule probablePitcher hydrate is best treated as PROBABLE in the canonical snapshot.
- Live game feed probable pitchers are also PROBABLE unless an explicit confirmed status is surfaced.
- Repository code treats `SCHEDULE_PROBABLE_TIMESTAMP_UNKNOWN` as the default probable state when no cutoff timestamp is recorded.

Recommendation: record the source category and sourceRefId for every pitcher snapshot entry. Do not upgrade PROBABLE to CONFIRMED without explicit source evidence.

## 13. Lineups and roster availability

Game feed `/game/{gamePk}/feed/live` is expected to contain lineup data, but this is not fully verified in the current repository code. FanGraphs and Baseball-Reference expose rosters with commercial-use restrictions. Retrosheet is post-hoc only.

Recommendation: treat lineup coverage as PARTIAL until live feed lineup schema is verified. Do not hard-code provider-specific lineup keys into the canonical snapshot payloads.

## 14. Team and pitcher statistics

MLB Stats API is verified to return season stats via `/people/{personId}/stats?stats=season&group=pitching` and `/teams/{teamId}/stats?stats=season&group=hitting|pitching`. Statcast CSV exports from Baseball Savant provide raw pitch/exit-velocity data but the programmatic license is UNKNOWN.

Recommendation: use MLB Stats API for standard season and game-log statistics. Use Baseball Savant CSV exports only through a verified licensed adapter, not in direct live ingestion code.

## 15. Advanced tracking metrics

Statcast data is official MLB advanced tracking data. Baseball Savant CSV docs verify existence and column names. No verified public API license was found as of 2026-07-31.

Recommendation: treat advanced metrics as a SUPPLEMENTAL source role. Inclusion requires explicit MLB or licensed aggregator authorization.

## 16. Bullpen context

Bullpen profiles in the repository are derived from team pitching stats and recent workload calculations. No live bullpen roster endpoint is explicitly verified in the current code.

Recommendation: construct bullpen context from canonical pitcher-stats sections and schedule-rest context until a verified live roster endpoint is licensed.

## 17. Rest, travel, and schedule density

The repository already derives these internally from canonical schedule blocks and timestamp arithmetic. No external source is strictly required beyond official game dates.

Recommendation: calculate rest/travel as INTERNAL_DERIVED sections from official schedule identity.

## 18. Venue and park context

`/venues/{venueId}` and schedule `venue` hydration are implemented in the repository. Venue latitude, longitude, timezone, and inferred roof type are available.

Recommendation: use MLB Stats API as the primary GAME_IDENTITY and VENUE_PARK source role.

## 19. Weather

Weather is explicitly optional in the current adapter. OpenWeatherMap and WeatherAPI are common choices but each has its own terms.

Recommendation: select a weather provider only after a separate terms review. Weather remains an OPTIONAL SUPPLEMENTAL source role.

## 20. Historical point-in-time availability

Retrosheet provides free bulk historical data but not as a point-in-time live feed. MLB Stats API historical access and schema backfill behavior are UNKNOWN because official documentation is gated. Sportradar and api-sports claim historical coverage but depth is UNVERIFIED.

Recommendation: before historical dataset construction, verify whether the chosen provider can supply point-in-time reconstructions for arbitrary past cutoffs without retroactive schema changes.

## 21. Source timestamps and corrections

MLB Stats API responses in the repository carry fresh `fetchedAt: new Date()` timestamps but no `sourceUpdatedAt` or correction/backfill guarantee. Retrosheet files are bulk releases with documented correction files.

Recommendation: require a `sourceUpdatedAt` field from any future adapter and document the source's retraction/correction policy.

## 22. Authentication, rate limits, and licensing

| Source | Auth required | Rate limits | Commercial use | Redistribution |
| --- | --- | --- | --- | --- |
| MLB Stats API | UNKNOWN (docs gate login; endpoint access appears open) | UNKNOWN | UNKNOWN | UNKNOWN |
| Retrosheet | No | Not applicable | Permitted with attribution | Permitted with attribution |
| Baseball Savant CSV | No for manual export; UNKNOWN for automated | UNKNOWN | UNKNOWN | UNKNOWN |
| FanGraphs | Yes (login for full access) | UNKNOWN | Prohibited | Prohibited |
| Sports Reference | Contact | UNKNOWN | Prohibited | Prohibited |
| Sportradar | Yes (API key) | Documented per plan | Requires paid license | Requires paid license |
| api-sports.io | Yes (API key) | Documented headers | Requires paid license | Requires paid license |

## 23. Reliability and outage behavior

MLB Stats API has observed retryable HTTP statuses (408, 429, 502, 503, 504) handled in `src/lib/research-data/mlb/stats-api-client.ts`. No SLA or outage communication channel is documented in the repository. Retrosheet is static file hosting and does not have outages of the same kind. Commercial aggregators generally have SLAs but require paid contracts.

## 24. Doubleheaders, neutral sites, postponements, and cancellations

MLB Stats API schedule response verifies `doubleHeader` string, `gameNumber` integer, cancelled/postponed detailed states, and venue hydration. Retrosheet event files capture game metadata but require post-processing to reconstruct doubleheader relationships. Neutral-site treatment in the repository is explicit through `neutralSite: boolean | null` rather than `homeAdvantage`.

## 25. Provider-specific schema risks

- MLB Stats API field names may change season to season without deprecation because official docs are not publicly versioned as of 2026-07-31.
- FanGraphs and Sports Reference use different ID spaces and column names; direct ingestion would hard-code foreign keys.
- Baseball Savant CSV column names are documented but file formats may evolve.
- Any adapter that copies raw response envelopes into section payloads introduces provider-specific keys and breaks the canonical boundary.

## 26. Recommended source roles

Primary source-role strategy:

- official schedule and game identity — MLB Stats API schedule endpoint.
- team and player identity — MLB Stats API, normalized to canonical string IDs.
- starting-pitcher information — MLB Stats API schedule probable pitcher hydrate and game feed.
- lineup and roster information — UNKNOWN until live feed lineup schema is verified under license.
- team statistics — MLB Stats API season stats endpoints.
- pitcher statistics — MLB Stats API season and game-log endpoints.
- advanced tracking metrics — Baseball Savant CSV exports, pending explicit license verification.
- weather — separate weather provider after independent terms review.
- venue and park information — MLB Stats API venues endpoint.
- historical point-in-time reconstruction — UNKNOWN. Requires verification that the primary source can reconstruct past game dates without retroactive schema changes. Retrosheet is a fallback for completed games with attribution.

## 27. Fallback strategy

If the primary schedule endpoint fails or returns partial data:

- Use cached canonical snapshots from a future local dataset (Phase 8D, not implemented).
- For completed historical games, fall back to Retrosheet event files after verifying attribution and ID mapping.
- Do not fall back to commercial odds providers or FanGraphs for snapshot data because they introduce licensing risk and contamination risk.

## 28. Unresolved unknowns

1. MLB Stats API commercial-use and redistribution terms as of 2026-07-31.
2. MLB Stats API documented rate limits and authentication requirements.
3. Historical point-in-time reconstruction fidelity of MLB Stats API.
4. Live feed lineup schema and its source-update timestamp semantics.
5. Baseball Savant CSV automated access terms.
6. Weather provider licensing selection.
7. Doubleheader and postponement correction cadence from the primary source.
8. Data latency from MLB Stats API relative to first pitch.

## 29. Phase 8C implementation boundary

Phase 8C implements the canonical snapshot contract and its validator. It does not implement a provider adapter, does not connect to live APIs, does not add credentials, does not persist snapshots, and does not choose a single provider as permanent runtime.

## 30. Deferred work

- Provider adapter construction.
- Source credential storage.
- Scheduled ingestion workers.
- Local snapshot caching and retrieval.
- Historical dataset construction.
- Point-in-time reconstruction verification.
- Weather provider selection and terms review.
- Production intake and monitoring.

## 31. Recommended next phase

Phase 8D — Implement the historical labelled dataset contract, point-in-time reconstruction boundary, and leakage protections.
