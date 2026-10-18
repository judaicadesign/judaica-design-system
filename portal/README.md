# Client portal — initial release

Customer entry: `portal/index.html`. Team entry: `portal/equipo.html`, linked from the internal navigation. Both use the existing Supabase Auth project. Customers use a separate browser storage key so team/customer sessions do not overwrite one another.

## Activate an account

1. Open the team page with an authorized `jd_team_access` account.
2. Select Abi (initially inactive with no email), enter her verified contact email, enable the account, choose shared Abi pricing or a private override, and save.
3. Create access. Copy the temporary password and send it through your usual channel. The system sends no email. Existing Auth accounts keep their current password.
4. Customer signs in and must change the temporary password before quoting or accessing orders.

Shared pricing is the existing `jd_whatsapp_pricing_v1` rule, editable in the internal B612 quote tool. Private overrides belong to the portal account. Prices are calculated in the Edge Function, never in the customer browser. A quote expires after seven days. A submitted order freezes the selected server-side prices; submission awaits file/payment review rather than automatically starting production.

## Security boundaries

- The five `jd_portal_*` tables have RLS enabled, with no grants to anon/authenticated. The Edge Function verifies each JWT through Auth and resolves fresh team/customer permissions for every request. User metadata grants no role.
- The function uses a service-role client only on the server. Its own verified authentication is why gateway `verify_jwt` is false. Never deploy a variant without that identity check.
- Supplier operations, costs and rule snapshots live in `jd_portal_quote_costs`. Customer responses use explicit allowlists; no raw supplier objects are spread into public DTOs. Quote and evidence saves are one transaction.
- Multi-product submission uses a service-only, SECURITY INVOKER RPC. It locks the customer's quotes, checks ownership and expiry, accepts only saved quantity alternatives, and computes totals from saved records. Idempotency keys protect retries.
- `jd-portal-files` is private. Upload paths are generated on the server and scoped to customer/order; uploads cannot overwrite. The backend checks size and PDF/JPEG/PNG signatures before exposing files. Downloads require ownership (or a team account) and receive 60-second links. Screenshots/copies by authorized recipients cannot be prevented.
- File uploads are closed once production begins. Receipts do not mark payments as received. Every admin status change is recorded and can include a client-visible message.

## Deployment and verification

Apply the tracked Supabase migrations, then deploy `supabase/functions/client-portal/index.ts` with its relative dependencies (`portal-core.mjs`, `b612-general.mjs`, `b612-cards.mjs`, `jd-whatsapp-pricing.js`, `assets/jd-print-request.js`). Supabase supplies server environment keys; none belongs in the frontend.

`npm test` includes mock-backed core/UI/wrapper tests plus existing regressions. `tests/client-portal-db.sql` is a real database integration test, run against Supabase in a transaction that rolls back its fixtures. Supplier fixtures establish arithmetic and no-cost-disclosure behavior, not current supplier availability. A live client session requires activating a real account with its email; no customer is impersonated during implementation.

First release covers general print intake, leaflet calculator, final prices, saved quantities, multi-product order requests, private print/reference/payment files, account provisioning and order administration. Unsupported work remains pending a personal quotation. Birkon catalogue choices, proof approval/Calaméo, print imposition, online payments, automatic printer submission, automated email and password recovery flows are deferred.
