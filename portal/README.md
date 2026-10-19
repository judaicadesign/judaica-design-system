# Client portal

Entry: portal/index.html. Team: portal/equipo.html. Share the portal URL itself; each visitor selects Crear cuenta and enters their own details and password. Registration signs the customer in and opens their workspace immediately. No account approval, invitation, activation link or outgoing email is involved. The earlier solicitar.html entry redirects to the portal signup tab.

Registration collects separate first/last names, optional business name, WhatsApp, optional Instagram, locality and email. Mi cuenta allows the authenticated customer to update their own profile. Contact details also appear in the team's account editor. Password requirements precede each new-password input, update as the user types, and show confirmation matching. Every password has an accessible visibility toggle. Creating an account needs no extra consent checkbox.

WhatsApp uses country, area and subscriber inputs, validated with the locally hosted, pinned libphonenumber-js 1.12.24 max metadata bundle (MIT license in assets). Argentina requires an area code; leading 0 and subscriber 15 are normalized, +54 9 is added, and the complete international number is shown before saving. Other countries use their actual numbering plans. This checks number format, not whether a number has an active WhatsApp account. The backend accepts only complete international contact values.

The customer starts in Trabajos en curso. Print quoting and the leaflet calculator live under Herramientas; saved quotes and the cart remain separate. Previous delivered/cancelled work is collapsed. Each work card uses its project/product title. Details group scope, participants, event, institution, contact, style, material instructions, dated history, files and receipts. Customers can add dated observations, names and other information. The team's Compartir trabajo form explicitly assigns a registered customer and can select an internal CRM job as its source. This creates a client-facing snapshot; it does not automatically mirror internal notes, costs, history or subsequent CRM edits. Update the shared details in the portal administration. No existing CRM job was shared during this release.

Luaj fields and the resource link follow the client's manual: one interlocutor, organized Drive materials, Leiluy Nishmat spreadsheet, visual references, deadlines and review. Spreadsheet folders remain in Drive; the portal uploads PDF/JPG/PNG up to 25 MB. Team-only Mockup uploads accept images, and Entrega digital explicitly identifies downloadable final files. Review links such as Calaméo do not expose the source PDF through the portal. Proof approval/version authorization is still separate future work.

Forgot-password uses Supabase resetPasswordForEmail and PASSWORD_RECOVERY, shows a new-password form and signs out after update. Recovery does not call the portal API or require an administrator to know/reset a client's password. Administrators cannot read passwords. Live email delivery and redirect configuration remain unverified: the current MCP connection does not expose Auth settings, and CLI config inspection reports AccessTokenRequiredError. To finish the mail setup, configure owned SMTP delivery and allow https://judaicadesign.github.io/judaica-design-system/portal/?recuperar=1 in Supabase Auth redirect URLs, then test with an owner-controlled mailbox. Default Supabase SMTP is restricted to organization team addresses. No recovery message was sent to a real recipient in this release.

The single pricing rule is jd_whatsapp_pricing_v1, editable in the internal B612 quote tool. Account overrides are rejected by the API and a database constraint. Supplier costs, operations and rule snapshots stay in a backend-only table; explicit response DTOs expose only the sale price. Saved quotes expire after seven days. Submitted multi-item orders freeze their server-side prices and await file/payment review.

## Identity and permissions

All portal tables have RLS enabled and no anon/authenticated Data API grants. The Edge Function verifies each private action's JWT with Auth and resolves fresh team/customer permissions. Customer access is bound to auth_user_id, not a user-editable email or metadata claim. Admin emails are reserved and cannot self-register. Disabled accounts cannot reactivate by registering again; preexisting unbound email records cannot be claimed. Duplicate Auth accounts are never reset: enrollment requires their existing password.

Public register-account validates profile data and the owner's chosen password, applies a server-salted IP rate limit of ten attempts per hour, and creates a password-based Auth account plus its private customer record. The operator explicitly chose immediate signup without email confirmation: contact email is not proof of email ownership. Binding access to the immutable Auth user ID prevents a self-registered email from claiming another account's existing records. The Auth account uses email_confirm=true to allow immediate password login; do not treat that flag as independent proof of email ownership for new password signups.

Only server code uses the service key. All database helper RPCs are service-only and SECURITY INVOKER. Legacy request/activation RPC execution is revoked; their old application records are retained privately. Old request/activation API actions return a retired-flow message instead of creating or enabling accounts. Phone/profile values never grant roles. Profile edits cannot change identity, enabled state or pricing.

The private jd-portal-files bucket uses server-generated customer/order paths, non-overwriting signed uploads, file size/signature checks and 60-second scoped downloads. Production closes uploads. Receipts do not record payment automatically. Every team order-state change can include a client-visible message and history entry.

## Google sign-in

Public Auth settings were checked: Google is disabled. Enabling it requires an owned Google Cloud OAuth client ID/secret configured in Supabase plus correct callback/portal redirect URLs. No Google credentials are available in this task, and no nonfunctional Google button is shown. Google can supply name/email; WhatsApp, business, Instagram and locality still need a one-time profile form. The current release supports email/password only.

## Verification

npm test includes the portal's authorization, sale-price isolation, direct registration, exact passwords, profile fields, automatic login and UI tests, plus existing regressions. tests/client-portal-db.sql tests real database transactions for registration/profile persistence, retries, disabled-account protection, signup rate limiting, legacy-flow retirement, price freezing, ownership and denied direct access. Its fixtures roll back; the test references an existing Auth UUID solely to validate a foreign key and creates/modifies no Auth account or session. Supplier fixtures establish arithmetic rather than current availability. No real recipient was impersonated or registered during implementation.

Deploy supabase/functions/client-portal/index.ts with its relative shared modules and assets/jd-print-request.js. Supabase supplies private runtime keys. Catalogue-driven Birkon/Luaj forms, protected proof viewers, proof approvals, PDF imposition, online payments and automatic printer submission remain deferred. The new recovery UI is implemented; email delivery requires the configuration and verification described above.


### Consultas por cotizar y respuesta manual

Cuando la cotización automática no produce un precio, o el cliente solicita cotización personalizada, la consulta queda en la bandeja de Administrar portal. No es un pedido confirmado y no envía correos automáticamente. El equipo completa proveedor privado, costo neto por alternativa y ficha pública; la regla compartida calcula el precio final. Publicar actualiza la cotización del cliente con siete días de vigencia. El cliente elige una cantidad, solicita el pedido y carga archivos mediante el circuito existente.

La publicación se guarda mediante jd_portal_publish_quote: bloqueo de fila, control de versión y conservación del antecedente en jd_portal_quote_costs. Los clientes no reciben proveedor, costo, evidencia ni regla comercial. Las consultas sin precio no pueden enviarse como pedidos.
