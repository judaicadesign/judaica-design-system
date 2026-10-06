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
