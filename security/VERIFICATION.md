# Auth and security verification — 2026-10-06

- Baseline: main `98adb14be46412767a3ee7173b73ad37c14824aa`; last Pages deployment succeeded.
- Backup: nine app_state rows and five Storage objects exported before security changes. ZIP integrity and SHA-256 manifest verified; persisted separately, never committed to this public repository.
- Existing dashboard observer caused a self-triggering rendering loop. Ignore its own card mutations.
- Previous bootstrap wrote catalog migrations during page load. Removed automatic REST writes and delay application initialization until Auth validation and remote hydration.
- Restore: the previous public bootstrap removed two catalog fields during inspection. A conditional restore recovered the exact pre-audit catalog. All nine row values and timestamps subsequently matched the backup.
- Production RLS: anon privileges revoked; authenticated access restricted to the authorized team table. Unauthorized signed-in identity sees zero state rows and zero files. Unauthorized insert fails with 42501. Authorized policy tests read nine rows and five files and exercise insert/update/delete inside a rolled-back transaction.
- Both Storage buckets are private. Asset previews and quote sharing use signed links (seven days).
- Both B612 Edge Functions validate access tokens against Supabase Auth and team authorization. OPTIONS remains public for CORS. verify_jwt=false is intentional: authentication is performed in function code to support current signing keys.
- Real unauthenticated REST and B612 requests return 401. Public PDF links no longer grant access.
- Auth SDK 2.117.2 is pinned and hosted locally. Publishable key is public by design; only actual Auth access tokens are sent as Bearer.
- Historical index.html scan: no sb_secret_, service-role JWT, or GitHub token matching the checked signatures across 73 commits. This is a targeted scan, not proof that no secret of any kind has ever existed. No GitGuardian administration API is available here; its incident status remains unverified.
- DOM regression tests use mocked Auth: anonymous gate, unauthorized gate, authorized hydration/rendering, no bootstrap writes, runtime error detection, catalog navigation. They are not live end-to-end authentication tests.
- Live Auth account count at audit: zero. Email signup enabled; confirmation required. The owner must create a password and confirm the email outside chat before a real login/session-refresh/logout round trip can be verified. Never request or commit the owner's password.

Deployment remains GitHub Pages with relative static assets and .nojekyll; no backend or build step is required by Pages. The SQL file records the already-applied security transition. Do not reapply it blindly to an already-migrated database.

## Interface and commercial regression — 2026-10-07 UTC

- The owner confirmed email signup and reported successful real login. The full live refresh/logout round trip is still not recorded as tested.
- Consolidated all 24 static style blocks into jd-base.css without altering their order or PDF/print rules. A separate screen-only interface layer handles mobile navigation, quote cards, spacing, keyboard access and form controls.
- Quote creation commits the quote list and client list together through one authenticated bulk upsert, after reading current remote state. Discount, internal note and cost reference are preserved. PDF/WhatsApp validation uses the same calculated quote instead of parsing price text from the DOM.
- Isolated synthetic tests cover four simultaneous quantities (50/75/100/200), lower-run estimation, empty/negative/fractional/duplicate quantities, missing/invalid supplier cost, missing client, invalid/excessive discount, B612 failure, expired session, failed save with retry, repeated click, existing client normalization and an additional remote quote from another device.
- Cost estimates retain original supplier cost/date, only affect new calculations and can be reset. Percentages or published IPC indices are entered manually; no automatic IPC feed is connected. Ratio calculation uses end index / start index; published month coverage is shown. Reapplying always starts from original cost.
- Estimate tests include 100000 + 8.5% = 108500, failed save, repeated adjustment, IPC period validation and reset. Test index values are fictional and must not be interpreted as current inflation data.
- tests/ui-preview.html is an isolated static snapshot of synthetic data for mobile/tablet/desktop visual QA. Its sandboxed frame has no Auth, Supabase access, localStorage operations or commercial mutations.
- Production remained at nine app_state rows, five quotes and five Storage files during this work. No simulated client, order or cost was written to production.
