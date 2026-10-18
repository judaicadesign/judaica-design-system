# Client portal — initial release

Customer entry: `portal/index.html`. Team entry: `portal/equipo.html`, linked from the internal navigation. Both use the existing Supabase Auth project. Customers use a separate browser storage key so team/customer sessions do not overwrite one another.

## Activate an account

1. Share `portal/solicitar.html` with any interested client. They submit their own name, email, optional WhatsApp and explicit request consent. No Auth account is created at this stage.
2. Review requests on the team page with an authorized `jd_team_access` account. Approving generates a personal, one-use activation link valid for seven days. Only its SHA-256 hash is stored. Renewal invalidates the old link.
3. Share that personal link ONLY with its intended recipient through a confirmed contact channel. Possession of this operator-delivered link establishes the recipient's identity; this release does not automatically email an email-verification link. The public application link can be sent to many people; the personal activation link must not be.
4. The recipient opens the private link and chooses their password. Only then is an Auth account created and portal access enabled. Existing Auth accounts must prove their existing password and are never reset by this flow. The operator does not know the chosen password.

The single shared pricing rule is `jd_whatsapp_pricing_v1`, editable in the internal B612 quote tool. Per-account overrides are disabled both in the API and by a database constraint. Prices are calculated in the Edge Function, never in the customer browser. A quote expires after seven days. A submitted order freezes the selected server-side prices; submission awaits file/payment review rather than automatically starting production.

## Security boundaries

- All six `jd_portal_*` tables have RLS enabled, with no grants to anon/authenticated. The Edge Function verifies each private action's JWT through Auth and resolves fresh team/customer permissions for every request. User metadata grants no role.
- Only `request-account` and `activate-account` are public. Requests are consent-validated, deduplicated without revealing account existence, and rate limited in a serialized database transaction using a server-salted hash of the forwarded IP. Activation requires the exact approved secret, a nonexpired lease, and an owner-chosen password. There is no public access to request lists, rules, costs, quotes, or orders.
- The function uses a service-role client only on the server. Its own private-action authentication and activation-secret verification are why gateway `verify_jwt` is false. Never deploy a variant without those checks. Activation leases prevent simultaneous consumption, release on failure, and recover after five minutes if a worker stops; a changed/rejected request cannot be finalized by an older worker.
- Supplier operations, costs and rule snapshots live in `jd_portal_quote_costs`. Customer responses use explicit allowlists; no raw supplier objects are spread into public DTOs. Quote and evidence saves are one transaction.
- Multi-product submission uses a service-only, SECURITY INVOKER RPC. It locks the customer's quotes, checks ownership and expiry, accepts only saved quantity alternatives, and computes totals from saved records. Idempotency keys protect retries.
- `jd-portal-files` is private. Upload paths are generated on the server and scoped to customer/order; uploads cannot overwrite. The backend checks size and PDF/JPEG/PNG signatures before exposing files. Downloads require ownership (or a team account) and receive 60-second links. Screenshots/copies by authorized recipients cannot be prevented.
- File uploads are closed once production begins. Receipts do not mark payments as received. Every admin status change is recorded and can include a client-visible message.

## Deployment and verification

Apply the tracked Supabase migrations, then deploy `supabase/functions/client-portal/index.ts` with its relative dependencies (`portal-core.mjs`, `b612-general.mjs`, `b612-cards.mjs`, `jd-whatsapp-pricing.js`, `assets/jd-print-request.js`). Supabase supplies server environment keys; none belongs in the frontend.

`npm test` includes mock-backed core/UI/wrapper tests plus existing regressions. `tests/client-portal-db.sql` is a real database integration test, run against Supabase in a transaction that rolls back its fixtures. Supplier fixtures establish arithmetic and no-cost-disclosure behavior, not current supplier availability. A live client session requires activating a real account with its email; no customer is impersonated during implementation.

First release covers general print intake, leaflet calculator, final prices, saved quantities, multi-product order requests, private print/reference/payment files, account provisioning and order administration. Unsupported work remains pending a personal quotation. Birkon catalogue choices, proof approval/Calaméo, print imposition, online payments, automatic printer submission, automated email and password recovery flows are deferred.
