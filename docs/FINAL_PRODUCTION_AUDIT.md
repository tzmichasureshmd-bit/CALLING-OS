# CallNexa Final Production Audit

> Working audit and ticket register. This document is updated as fixes and verification complete.

## Audit baseline

- Branch: `main` tracking `origin/main`
- Baseline revision: `d71b032` (`feat: add built-in call recording - auto-records all calls and uploads to Supabase`)
- Working tree: already contained modified and untracked files before this audit. Those changes are preserved.
- Intended mobile version from Expo/native config: `1.1.0` (`versionCode 2`).
- Live database rule: read-only schema/health checks only. No reset, truncate, destructive migration, seed, or mutating integration script will be run by this audit.
- Historical backend result: a previous session reported `10/10`, but that script mutates the configured database and bypasses the HTTP API. It is historical evidence only, not a current full-platform pass.

## Initial release gate

**NOT READY** at the read-only baseline. Confirmed P0/P1 findings must be fixed or explicitly blocked before an APK is offered for acceptance testing.

## Ticket register

### CNX-SEC-001 — Secrets committed in deployment files and Docker build-context leakage

- **Priority / severity:** P0 / Critical
- **Category:** Security / DevOps
- **Affected:** `backend/docker-compose.yml`, `.github/workflows/deploy.yml`, tracked backend helper scripts, `backend/Dockerfile`, `web/Dockerfile`
- **Description:** Tracked files contain production credential literals. Both Docker contexts lack `.dockerignore`, while Dockerfiles use `COPY . .`.
- **Reproduction:** Inspect tracked deployment files and Docker context rules. Do not print the values.
- **Expected:** Secrets come only from protected runtime/deployment variables; ignored developer files never enter build contexts.
- **Actual:** Sensitive values are committed and ignored files can enter image layers/build contexts.
- **Evidence:** Source inspection and `git ls-files` confirmed affected files are tracked.
- **Root cause:** Environment configuration was embedded directly into deployment manifests; Git ignore was mistaken for Docker context exclusion.
- **Proposed fix:** Replace literals with environment/secret references, make migration execution consume runtime credentials, add strict `.dockerignore` files, and rotate exposed credentials outside this repository.
- **Acceptance criteria:** No server secret literal remains in tracked deployment/runtime files; Docker contexts exclude `.env*`, logs, virtualenvs, dependencies, build outputs, keys, and service-account files; exposed credentials are rotated by an authorized operator.
- **Regression tests:** Secret-name/content scan without printing values; Docker build-context/config validation.
- **Status:** In Progress

### CNX-SEC-002 — Employee can act through another employee's device or call

- **Priority / severity:** P0 / Critical
- **Category:** Authorization / Tenant isolation
- **Affected:** `backend/app/routers/devices.py`, `backend/app/routers/calls.py`
- **Description:** Organization scope is checked, but employee ownership is absent on heartbeat/reconnect/SIM sync and `/calls/sync`; single-call lookup can fail open when an employee profile is missing; note updates lack employee ownership checks.
- **Reproduction:** Authenticate as employee A and submit employee B's device/call ID in the same organization.
- **Expected:** Employees may operate only their own device and calls; managers/admins follow explicit role policy; missing employee mappings fail closed.
- **Actual:** Several routes accept any organization-owned device/call.
- **Evidence:** Source inspection of route filters.
- **Root cause:** Tenant checks were used where resource-owner checks were required.
- **Proposed fix:** Add shared device/call ownership predicates and fail-closed employee handling.
- **Acceptance criteria:** Cross-employee attempts return 403/404 and cannot alter attribution, notes, heartbeat, reconnect flags, or SIM inventory.
- **Regression tests:** API authorization matrix for employee/admin and same/cross organization resources.
- **Status:** Open

### CNX-PRIV-001 — Mobile may inspect/transmit audio before explicit Business classification and accepts weak recording matches

- **Priority / severity:** P0 / Critical
- **Category:** Recording privacy
- **Affected:** `mobile/src/syncService.js`, `mobile/src/callLogService.js`, `mobile/android/app/src/main/java/com/tzmicha/callnexa/RecordingModule.kt`
- **Description:** Mobile checks recording preference and excluded number but not backend Business classification before file discovery/upload. Native confidence score 1 can be only a broad time-window match; JS fallback returns the first time-window file.
- **Reproduction:** Place an unrelated audio file in the matching time window for an unclassified call and run recording discovery.
- **Expected:** Mobile touches/uploads audio only for explicit Business calls, and only a strong unambiguous match may be selected.
- **Actual:** Backend ultimately returns 403 for unclassified/personal calls, but multipart data may already traverse the network; unrelated audio may be selected.
- **Evidence:** Source inspection of `_checkAndUploadRecording`, native scoring, and JS fallback.
- **Root cause:** Backend was treated as the only classification gate; match threshold was optimized for recall rather than privacy.
- **Proposed fix:** Fetch authoritative call classification before discovery, require `business`, and require strong evidence (minimum confidence / filename evidence) before selection.
- **Acceptance criteria:** Personal/unclassified/disabled/excluded cases never begin file discovery/upload; weak or ambiguous matches return unavailable.
- **Regression tests:** Privacy matrix and deterministic recording-match fixtures; physical OEM recording test.
- **Status:** Open

### CNX-PRIV-002 — Privacy/exclusion changes can race in-flight transcription and leave retained audio

- **Priority / severity:** P0 / Critical
- **Category:** Recording privacy / AI
- **Affected:** `backend/app/routers/calls.py`, `backend/app/routers/transcripts.py`, excluded-number routes
- **Description:** Workers check classification only at start, not before persisting output; they do not recheck excluded numbers. Reclassifying a Business call as Personal does not remove existing audio/transcript/summary or cancel/neutralize work.
- **Reproduction:** Start transcription, then classify the call Personal or exclude the number before worker completion.
- **Expected:** No transcript/summary is persisted after eligibility is revoked; retained audio is removed or placed into a fail-closed deletion workflow.
- **Actual:** Worker may write results after revocation and existing audio remains until a separate admin delete.
- **Evidence:** Source inspection of privacy endpoint and worker transaction boundaries.
- **Root cause:** Eligibility is checked once instead of at claim and commit boundaries.
- **Proposed fix:** Centralize eligibility checks, recheck before persistence, clear derived data on Personal, and make storage deletion failure visible/retryable.
- **Acceptance criteria:** Revoked eligibility prevents future persisted transcript/summary and no UI reports processing as successful.
- **Regression tests:** Race-oriented worker tests and privacy matrix.
- **Status:** Open

### CNX-SYNC-001 — Organization-wide event ID collides across Android devices

- **Priority / severity:** P1 / High
- **Category:** Data integrity / Synchronization
- **Affected:** `mobile/src/callLogService.js`, `backend/app/models/call.py`, `backend/app/routers/calls.py`, database migration
- **Description:** Mobile IDs are `android-<CallLog row id>`, but backend uniqueness/dedup uses `(organization_id, client_event_id)`. Android row IDs are device-local.
- **Reproduction:** Sync `android-1` from two devices in one organization.
- **Expected:** Both logical calls persist; retries from the same device remain idempotent.
- **Actual:** The second device can receive `duplicate` for the first device's call.
- **Evidence:** Source-proven key-domain mismatch.
- **Root cause:** Device identity was omitted from the server idempotency scope.
- **Proposed fix:** Preserve the client ID and change backend lookup/unique index to `(organization_id, device_id, client_event_id)` through a reviewed migration.
- **Acceptance criteria:** Same ID on different devices creates two calls; same ID on the same device returns the original call.
- **Regression tests:** Sequential and concurrent two-device idempotency tests.
- **Status:** Open

### CNX-SYNC-002 — Manual Sync bypasses the canonical synchronization pipeline

- **Priority / severity:** P1 / High
- **Category:** Mobile synchronization
- **Affected:** `mobile/app/(tabs)/settings.jsx`, `mobile/src/AuthContext.jsx`, `mobile/src/syncService.js`
- **Description:** The wired Settings handler directly reads/sends calls and bypasses install cutoff, canonical SIM filtering, per-item acknowledgements, status tracking, recording flow, and concurrency control. It records a successful last-sync time even after partial failures and displays the wrong automatic interval.
- **Reproduction:** Trigger Settings Sync with a pre-install call or a 200 response containing failed results.
- **Expected:** Automatic and manual paths invoke one pipeline and expose truthful aggregate results.
- **Actual:** Behavior diverges and success can be misleading.
- **Evidence:** Exhaustive call-site search found two `api.syncCalls` callers; Settings is the divergent one.
- **Root cause:** UI duplicated synchronization logic instead of using `AuthContext.syncCalls`.
- **Proposed fix:** Make the canonical pipeline return a result, serialize all callers, and have Settings delegate to it.
- **Acceptance criteria:** Only `syncService` calls `api.syncCalls`; manual results reflect per-item acknowledgements; failed cycles do not update last-success time.
- **Regression tests:** Static call-site assertion and sync-service unit tests.
- **Status:** Open

### CNX-AUTH-001 — Mobile does not refresh an expired token during a request

- **Priority / severity:** P1 / High
- **Category:** Authentication / Reliability
- **Affected:** `mobile/src/api.js`, `mobile/src/AuthContext.jsx`
- **Description:** Mobile refreshes on app startup only. A runtime 401 leaves automatic sync failing until restart/login.
- **Reproduction:** Let access token expire while app remains open, then sync.
- **Expected:** One coalesced refresh occurs and the original request retries once; invalid refresh requires login without dropping call recoverability.
- **Actual:** Request throws and periodic sync repeatedly fails.
- **Evidence:** Source inspection.
- **Root cause:** Request wrapper lacks a 401 refresh interceptor.
- **Proposed fix:** Add guarded, single-flight refresh-and-retry logic without changing endpoint contracts.
- **Acceptance criteria:** Concurrent 401s cause one refresh; each request retries once; no loop.
- **Regression tests:** Mocked request/refresh tests; physical expiry test.
- **Status:** Open

### CNX-AUTH-002 — Enabled TOTP is not enforced and tenant email login is ambiguous

- **Priority / severity:** P1 / High
- **Category:** Authentication security
- **Affected:** `backend/app/routers/auth.py`, auth schemas, web/mobile login UX
- **Description:** TOTP setup state has no effect on login. Password login selects email globally even though model uniqueness is per organization.
- **Evidence:** Source inspection.
- **Root cause:** Enrollment endpoints were added without completing challenge flow; tenant selector is absent from login contract.
- **Proposed fix:** Product/API design for two-step login and explicit tenant selection. This cannot be safely patched without coordinated client contract work.
- **Acceptance criteria:** Enabled TOTP blocks token issuance until valid challenge; duplicate tenant emails resolve deterministically.
- **Regression tests:** Full auth matrix.
- **Status:** Blocked — coordinated contract/UI decision required

### CNX-WEB-001 — Opening Call Intelligence can throw `reload is not defined`

- **Priority / severity:** P1 / High
- **Category:** Web dashboard runtime
- **Affected:** `web/src/pages/CallLogs.jsx`, `CallIntelligenceDrawer`
- **Description:** Drawer references `reload` outside its lexical scope.
- **Reproduction:** Open any call row and render the Progress panel.
- **Expected:** Drawer renders and saved progress refreshes the list.
- **Actual:** Runtime `ReferenceError` is possible.
- **Evidence:** Source inspection.
- **Root cause:** Parent callback was not passed as a prop.
- **Proposed fix:** Pass `reload` to the drawer and include it in its signature.
- **Acceptance criteria:** Drawer opens and progress save refreshes without console errors.
- **Regression tests:** Web production build plus browser/manual component test.
- **Status:** Open

### CNX-WEB-002 — Transcription page subscribes to a nonexistent WebSocket route

- **Priority / severity:** P1 / High
- **Category:** Web real-time updates
- **Affected:** `web/src/pages/Transcribe.jsx`, `web/src/api/useDeviceSocket.js`
- **Description:** Page connects to `/api/v1/ws`; backend exposes `/api/v1/devices/ws/{org_id}`. It has no reconnection/fallback and captures stale filters.
- **Reproduction:** Start a transcript while the page is open and inspect the socket request/update behavior.
- **Expected:** Existing authorized WS/SSE/polling mechanism refreshes current filters and summary state.
- **Actual:** Socket route does not exist; updates can remain stale.
- **Evidence:** Source route comparison.
- **Root cause:** Page implemented a second obsolete socket client.
- **Proposed fix:** Reuse `useDeviceSocket`, include `summary_updated`, and keep polling until both transcript and summary reach terminal states.
- **Acceptance criteria:** Recording/transcript/summary events refresh the current page; disconnect fallback still discovers updates.
- **Regression tests:** Build and browser disconnect/reconnect test.
- **Status:** Open

### CNX-WEB-003 — Call dashboard silently truncates filtering/export to the newest 200 calls

- **Priority / severity:** P1 / High
- **Category:** Dashboard correctness
- **Affected:** `web/src/pages/CallLogs.jsx`, `web/src/api/dataSource.js`
- **Description:** Only page 1 with 200 rows is loaded; all filters, counts, employees, and CSV operate on that subset. Range changes refetch the same request.
- **Reproduction:** Create more than 200 authorized calls and search/filter/export an older matching call.
- **Expected:** Range/filter result represents all authorized matching rows or exposes accurate pagination.
- **Actual:** Older rows are hidden without disclosure.
- **Evidence:** Source inspection.
- **Root cause:** Client-only filtering was combined with a fixed server page.
- **Proposed fix:** Send range bounds and retrieve all pages for the selected bounded range without changing the visible UI.
- **Acceptance criteria:** Calls beyond page 1 are discoverable and totals/CSV match API results.
- **Regression tests:** >500-row API fixture and build.
- **Status:** Open

### CNX-WEB-004 — Organization switching mixes access and refresh-token state

- **Priority / severity:** P1 / High
- **Category:** Web authentication / Tenant isolation
- **Affected:** `web/src/components/Topbar.jsx`, `web/src/api/client.js`, `web/src/context/AuthContext.jsx`
- **Description:** Switching replaces only access token; refresh uses the previous account's token. Saved account records do not receive rotated tokens and survive logout.
- **Reproduction:** Save two organizations, switch, let the access token expire, then issue a request.
- **Expected:** Access/user/refresh state changes atomically and logout removes retained credentials.
- **Actual:** Refresh can target the wrong organization and token material remains in local storage.
- **Evidence:** Source inspection.
- **Root cause:** Account-switch storage and global Axios token state are not coordinated.
- **Proposed fix:** Atomically switch/restore both tokens, update saved account after rotation, rollback partial sessions, and clear saved credentials on logout.
- **Acceptance criteria:** Expiry after switch refreshes the selected account only; logout removes all retained account tokens.
- **Regression tests:** Two-account token rotation tests.
- **Status:** Open

### CNX-AI-001 — Transcription jobs/statuses are process-local and race privacy/status changes

- **Priority / severity:** P1 / High
- **Category:** AI / Reliability
- **Affected:** `backend/app/routers/calls.py`, `backend/app/routers/transcripts.py`, `backend/app/main.py`
- **Description:** Automatic worker starts from `pending` without marking `processing`; duplicate jobs can be scheduled; BackgroundTasks are non-durable; startup recovery misses pending jobs and summaries.
- **Expected:** Accurate atomic states and recoverable/idempotent processing.
- **Actual:** Restarts or repeated uploads can leave stale or duplicate work.
- **Evidence:** Source inspection.
- **Root cause:** In-process background work has no durable claim/job identity.
- **Proposed fix:** Immediate safe fixes: mark processing and add final privacy checks. Durable queue/worker requires a separately approved infrastructure change.
- **Acceptance criteria:** No false status/duplicate job in normal flow; interrupted jobs are detectable and retryable.
- **Regression tests:** Worker state/race tests and restart acceptance test.
- **Status:** Open

### CNX-AND-001 — Built-in call recorder starts after call completion and is never stopped

- **Priority / severity:** P1 / High
- **Category:** Android recording
- **Affected:** `mobile/src/syncService.js`, `mobile/src/callRecordingService.js`, `CallRecorderModule.kt`
- **Description:** Recorder is invoked only after CallLog discovery, while no phone-state start/stop listener exists. Stop/listener imports are unused; status constant is undefined; output is not searched by discovery.
- **Expected:** Unsupported capture is not started; supported OEM recordings are discovered safely.
- **Actual:** Recorder can fail or remain active and cannot feed the upload flow.
- **Evidence:** Source inspection.
- **Root cause:** Partial recorder implementation was wired to the post-call sync stage.
- **Proposed fix:** Disable the broken invocation for this release and retain supported OEM/MediaStore discovery. A real call-state recorder needs a separately scoped device/policy project.
- **Acceptance criteria:** Sync never starts an unbounded recorder; recording discovery remains functional.
- **Regression tests:** Bundle/native compile and device OEM-recording test.
- **Status:** Open

### CNX-DB-001 — Migration execution is unversioned, non-transactional, and ignores failures

- **Priority / severity:** P1 / High
- **Category:** Database / Deployment
- **Affected:** `backend/migration_runner.py`, `.github/workflows/deploy.yml`, migrations
- **Description:** Static/manual migration list and deployment rerun raw SQL without a ledger; deployment continues after errors.
- **Expected:** Ordered, fail-fast, recorded migrations run before compatible app activation.
- **Actual:** Partial schema application can deploy incompatible code.
- **Evidence:** Source inspection.
- **Root cause:** Ad-hoc migration process.
- **Proposed fix:** Make current runner credential-free and fail-fast now; plan Alembic/version ledger separately.
- **Acceptance criteria:** Any migration error blocks deployment and no credential is embedded.
- **Regression tests:** Migration dry run against an isolated disposable database.
- **Status:** Open

### CNX-SEC-003 — Rate limiting is ineffective and error CORS bypasses the allowlist

- **Priority / severity:** P2 / Medium
- **Category:** API security
- **Affected:** `backend/app/main.py`, auth endpoints
- **Description:** SlowAPI limiter is configured without middleware/decorators. Error handlers reflect arbitrary Origin with credentials.
- **Expected:** Auth endpoints are rate-limited and all responses use the configured origin policy.
- **Actual:** Effective limit is absent and error response headers bypass policy.
- **Evidence:** Source inspection.
- **Root cause:** Partial middleware integration and manual CORS headers.
- **Proposed fix:** Install SlowAPI middleware and endpoint limits; remove manual CORS headers from exception handlers.
- **Acceptance criteria:** Repeated auth requests receive 429; unapproved origins never receive credentialed CORS.
- **Regression tests:** API security tests.
- **Status:** Open

### CNX-SIM-001 — Native call-log query depends on a non-portable `subscription_id` column

- **Priority / severity:** P2 / Medium
- **Category:** Android / SIM mapping
- **Affected:** `CallLogModule.kt`, `nativeModules.js`, SIM filter
- **Description:** Some providers omit the literal column, causing the entire native query to fail; phone account IDs are not guaranteed subscription IDs.
- **Expected:** Core call query uses portable columns and uncertain SIM mapping fails safely/visibly.
- **Actual:** OEM variance can force fallback or misclassify selected SIM.
- **Evidence:** Source inspection; exact OEM behavior requires devices.
- **Proposed fix:** Query portable columns and isolate optional metadata retrieval; do not discard uncertain calls silently.
- **Acceptance criteria:** Missing optional SIM columns cannot make the call query fail.
- **Regression tests:** Native provider variants and physical dual-SIM devices.
- **Status:** Open

### CNX-BUILD-001 — Production JavaScript bundle failed on duplicate `TYPE` declaration

- **Priority / severity:** P1 / High
- **Category:** Android build
- **Affected:** `mobile/app/(tabs)/logs.jsx`
- **Description:** Imported typography `TYPE` collided with a local call-type constant.
- **Expected:** Metro production bundle compiles.
- **Actual:** Prior EAS build failed in Bundle JavaScript.
- **Evidence:** Prior build log and local Metro reproduction; working tree contains a rename to `CALL_TYPE`.
- **Root cause:** Duplicate lexical identifier.
- **Proposed fix:** Preserve the existing minimal rename and rerun production export/build.
- **Acceptance criteria:** `expo export --platform android` and APK build succeed.
- **Regression tests:** Mobile production export and Android assemble.
- **Status:** Fixed, verification pending in this audit

### CNX-BUILD-002 — Direct Android release uses debug signing

- **Priority / severity:** P1 / High for store release; P2 for internal APK acceptance
- **Category:** Release signing
- **Affected:** `mobile/android/app/build.gradle`, EAS credential state
- **Description:** Direct Gradle release signs with the tracked debug key. EAS-managed signing cannot be proven from source.
- **Expected:** Production AAB/APK uses an authorized protected upload key.
- **Actual:** Direct release is debug-signed; remote signing state is unknown.
- **Evidence:** Source inspection.
- **Root cause:** Generated development signing configuration was retained.
- **Proposed fix:** Use EAS-managed credentials for internal acceptance; configure/verify protected production upload signing before store release.
- **Acceptance criteria:** Artifact certificate fingerprint matches approved release key.
- **Regression tests:** `apksigner verify --print-certs` on actual output.
- **Status:** Blocked for production release; does not block an internal EAS APK after credential verification

## Physical-device acceptance

All `AND-01` through `AND-20` from the master audit remain **MANUAL REQUIRED** until an actual APK is installed and tested. Source inspection cannot convert them to PASS.
