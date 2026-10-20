# Supplier account, Google bridge and proof review

The internal menu and each job's Imprenta tab link to `portal/proveedores.html`.
The team can create Zloto charges and payments, attach private PDF/JPG/PNG receipts,
link a job, and inspect the imported WhatsApp archive. Importing old payments does
not create new finance expenses. Posting a charge records cost without cash flow;
posting a payment records cash flow without adding that cost again. Voids retain
audit history. Historical receipt matches preserve the original ledger amounts.

## One-time Google setup

From Cuenta de Zloto choose Preparar conector de Google. Copy the generated code
into a **private** Apps Script project in the Google account with edit access to
both spreadsheets; run `conectarJD` and authorize Google. The token is scoped to
pending exports and their receipts. Regenerating it revokes the previous connector.
The installed trigger runs every minute. The UI distinguishes pending, synced and
conflicting exports; preparing a token alone does not mean the trigger is installed.

The budget export writes only connector-owned JD rows. Personal/Kolel rows are
untouched. Income uses actual recorded receipts; costs exclude supplier settlement
payments, so a charge and its payment do not count twice. Existing historical row
matches stop for reconciliation rather than duplicating/overwriting them. The
current budget summary is bounded at row 503: exports beyond it require the owner
to extend the summary formulas first. The percentage and `a dar` formula live only
in Sheets; existing row percentages are retained, with 10% the default for new rows.
Unassigned JD income/expense movements are exported separately; moving a cost into a job zeroes its previous standalone export to avoid duplication. JD does not calculate or track maaser.

Zloto exports preserve the two independent tables. For imported payments only the
receipt link is written in column M after verifying the source row. Receipts are
copied to a private Drive folder shared with explicit readers/editors of the Zloto
spreadsheet, never anonymously. If sharing cannot be verified, the export stops.

## Proofs

Open a shared work from `portal/equipo.html`, then Revisión de muestras. Upload
one PDF or an ordered image series. PDF.js converts the PDF on the administrator's
device; only review JPEG pages are uploaded, not the source PDF. Mark a version as
final only when it contains every printable page/face. The customer can zoom,
change pages, mark coordinates, comment, reply, resolve and approve that exact
version from their own account. Open observations block approval. Publishing a
new version invalidates the job's prior client check while retaining the approval
history. Approval never dispatches a print job or replaces internal quality control.

The viewer doesn't expose the original PDF or a download control. Browser images
and screenshots cannot be made uncopyable; raster review is not absolute DRM.
All storage is private; the backend verifies team/customer ownership before issuing
short-lived page URLs. Direct review, supplier and archive table access is denied.

## Validation

`npm test` includes customer isolation, frontend payment/upload and review controls,
finance cost/cash separation and mocked Sheets retry/conflict behavior. Run
`tests/supplier-proofing-db.sql` as administrator for rollback-only RPC tests of
approval/version locks, idempotent supplier posting and backend-only permissions.
An actual PDF was rendered with the pinned PDF.js 6.4.299 and visually inspected.
The temporary migration upload endpoint was disabled after the private import.
