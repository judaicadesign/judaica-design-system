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
# 2026-10-07 — CRM, orders, A4 and atomic commits

- Read-only audit: 9 commercial collections, 5 saved quotes, 5 storage files. Every commercial JSON value matches the verified prior backup (timestamps are not used for that comparison). ZIP integrity passed.
- Additive `jd_commit_state(jsonb)` RPC: SECURITY INVOKER, empty search_path, authenticated team only, non-anonymous identities, deterministic transaction lock order, compare-and-swap and atomic rollback across keys. No commercial rows migrated.
- Browser writes, including legacy REST POST handlers, now route through that RPC. No fallback to blind upsert after a conflict.
- After successful Pages deployment, RLS write policies were tightened to require the transaction-local atomic-write context. Blind legacy writes now fail; old browser tabs must reload. Live rollback-only assertions verified denied direct writes, allowed RPC, conflict rejection and full batch rollback. Production remained 9 collections / 5 quotes / 5 files.
- CRM supports email, delivery recipient, address, city/province, postal code, country and notes; separate first/last/institution fields retained. Failed writes keep the modal open. Same-client remote changes rejected.
- Per-quantity gross estimated profit and margin include supplier cost, shipping, discount and price rounding; explicitly exclude taxes and design labour.
- Quote search/status filter; revisions link to their parent without editing historical prices. WhatsApp opening creates only a prepared draft, with a PDF snapshot; explicit team confirmation is needed for sent status.
- Order acceptance selects one quantity and freezes its price, shipping, profit and quote snapshot. Deposits, balance, stages and delivery address/date are stored per order.
- PDF capture always clones at desktop width and fits the complete content within one A4 with 6 mm margins; tall-canvas tests assert one image, no extra page and no clipping. Visual readability for unusually long content still needs real-PDF inspection.
- Automated tests: boot with no/denied/allowed auth, race between read and commit, commercial edge cases, CRM conflict/retry, A4 geometry, order deposit/overpayment/retry/delivery, supplier offline, inflation original preservation. Simulations do not write production data.
- Database function tests use rollback-only transactions. Security advisor reports leaked-password protection disabled; dashboard configuration remains pending. Existing signup redirect review and GitGuardian administrative incident closure remain unverified.
- Official IPC automatic retrieval remains pending; manual percentage and manually verified IPC indices remain explicitly estimates, never automatic supplier confirmation.
# 2026-10-07 — Edit existing quotes

- Explicit Edit action keeps the quote ID, original creation date and its place in the list. Quantity, pricing and configuration changes replace that record atomically with the client linkage.
- Each prior revision is preserved as an immutable snapshot, including its sent status and PDF. Current PDF/sent metadata is invalidated after editing; History opens prior PDFs using renewed private signed links.
- Each uploaded PDF now has a unique revision-specific object path. Editing/resending cannot overwrite the original Storage object.
- Same-record conflict detection ignores renewed Storage URL tokens but includes commercial fields and revision history. A missing/deleted or remotely changed quote is never silently recreated or overwritten.
- Send while editing saves the changes and attaches the generated PDF to the same ID. Already accepted orders remain frozen and unchanged.
- Tests simulate 50/100 → 75 units, failed-write retry, old-PDF/history preservation, remote edit conflict, resending twice to distinct Storage paths and accepted-order price preservation. No production commercial records were edited during verification.

## 2026-10-07 — Negotiated quote prices

- Optional manual total per quantity may raise or lower the suggested price. A separate nonnegative discount applies exactly to each alternative; it is not rounded again to 5000 after subtraction. Automatic suggested prices retain the existing 5000 rounding.
- Customer PDF capture shows price before discount, discount and final total. Internal calculation, supplier costs and estimated profit stay out of the customer view.
- Editing preserves the quoted pre-discount prices, while resetting to calculation or opening a new version uses current costs. Configuration changes clear manual overrides. Prior revisions and accepted orders remain unchanged.
- Synthetic tests cover a 260000 base minus 50000 discount = 210000 final, different totals per quantity, precise cents, lower prices, PDF capture, persistence, revision snapshots and invalid inputs. Existing Auth, CAS, retry, A4 and order tests also pass.
- No schema, Auth or RLS changes required. Read-only production verification: 9 collections, 5 quotes, 5 Storage files. No simulated commercial writes.
