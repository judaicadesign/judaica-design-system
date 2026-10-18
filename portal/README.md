# Client portal

Entry: portal/index.html. Team: portal/equipo.html. Share the portal URL itself; each visitor selects Crear cuenta and enters their own details and password. Registration signs the customer in and opens their workspace immediately. No account approval, invitation, activation link or outgoing email is involved. The earlier solicitar.html entry redirects to the portal signup tab.

Registration collects separate first/last names, optional business name, WhatsApp, optional Instagram, locality and email. Mi cuenta allows the authenticated customer to update their own profile. Contact details also appear in the team's account editor. One client identity can own multiple independent orders; catalogue Birkon/Luaj workflows and Calaméo/proof approval integrations remain separate future work.

The single pricing rule is jd_whatsapp_pricing_v1, editable in the internal B612 quote tool. Account overrides are rejected by the API and a database constraint. Supplier costs, operations and rule snapshots stay in a backend-only table; explicit response DTOs expose only the sale price. Saved quotes expire after seven days. Submitted multi-item orders freeze their server-side prices and await file/payment review.

## Identity and permissions

All portal tables have RLS enabled and no anon/authenticated Data API grants. The Edge Function verifies each private action's JWT with Auth and resolves fresh team/customer permissions. Customer access is bound to auth_user_id, not a user-editable email or metadata claim. Admin emails are reserved and cannot self-register. Disabled accounts cannot reactivate by registering again; preexisting unbound email records cannot be claimed. Duplicate Auth accounts are never reset: enrollment requires their existing password.

Public register-account validates explicit consent and profile data, applies a server-salted IP rate limit of ten attempts per hour, and creates a password-based Auth account plus its private customer record. The operator explicitly chose immediate signup without email confirmation: contact email is not proof of email ownership. Binding access to the immutable Auth user ID prevents a self-registered email from claiming another account's existing records. The Auth account uses email_confirm=true to allow immediate password login; do not treat that flag as independent proof of email ownership for new password signups.

Only server code uses the service key. All database helper RPCs are service-only and SECURITY INVOKER. Legacy request/activation RPC execution is revoked; their old application records are retained privately. Old request/activation API actions return a retired-flow message instead of creating or enabling accounts. Phone/profile values never grant roles. Profile edits cannot change identity, enabled state or pricing.

The private jd-portal-files bucket uses server-generated customer/order paths, non-overwriting signed uploads, file size/signature checks and 60-second scoped downloads. Production closes uploads. Receipts do not record payment automatically. Every team order-state change can include a client-visible message and history entry.

## Google sign-in

Public Auth settings were checked: Google is disabled. Enabling it requires an owned Google Cloud OAuth client ID/secret configured in Supabase plus correct callback/portal redirect URLs. No Google credentials are available in this task, and no nonfunctional Google button is shown. Google can supply name/email; WhatsApp, business, Instagram and locality still need a one-time profile form. The current release supports email/password only.

## Verification

npm test includes the portal's authorization, sale-price isolation, direct registration, exact passwords, profile fields, automatic login and UI tests, plus existing regressions. tests/client-portal-db.sql tests real database transactions for registration/profile persistence, retries, disabled-account protection, signup rate limiting, legacy-flow retirement, price freezing, ownership and denied direct access. Its fixtures roll back; the test references an existing Auth UUID solely to validate a foreign key and creates/modifies no Auth account or session. Supplier fixtures establish arithmetic rather than current availability. No real recipient was impersonated or registered during implementation.

Deploy supabase/functions/client-portal/index.ts with its relative shared modules and assets/jd-print-request.js. Supabase supplies private runtime keys. Birkon/Luaj catalogue linking, protected proof viewers, proof approvals, PDF imposition, online payments, automatic printer submission and password recovery emails are deferred.
