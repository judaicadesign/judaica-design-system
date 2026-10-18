# Regression checks

Install the pinned development dependency with `npm ci`, then run `npm test`.
All Auth, database, Storage and supplier operations are mocked. No credentials
are needed and tests never contact production. The commercial scenarios exercise
the actual application scripts with synthetic clients, products and costs.

`ui-preview.html` is a static visual fixture for 390/768/1280 px viewports.
Use its screen selector to inspect each section. It has no connection to the
live database; commercial controls are disabled. Source data comes from
`commercial-scenarios.cjs`, not a business backup.

IPC estimates use manually supplied published indices. No live inflation rate
is embedded in this test suite or in the application.

Manual pricing scenarios cover independent totals for each requested quantity,
increases/decreases relative to the suggested calculation, exact currency discounts,
the customer PDF capture (before-discount price, discount, final total), profit
and unchanged supplier costs. Editing retains the previously quoted base price;
resetting or creating a new version restores automatic calculation. Invalid prices
and discounts cannot bypass missing supplier costs or authenticated atomic saves.

## Client directory (PR #17 follow-up)

`tests/client-table.cjs` covers action-cell structure and interactions, homonymous
clients, quote filtering by client ID (including renamed contacts), legacy quotes
without an ID, archived/trash views, restoration and changing quote counters.

For **visual** validation, open the current app (not the older static CRM snapshot
in `ui-preview.html`) at 390, 768 and 1280 CSS pixels. Check clients with and
without quotes, long names/addresses, three action buttons, archived/trash
views, search-hidden rows, focus outlines and full row/card borders.
At widths up to 1150 px, the client list deliberately uses stacked cards;
at wider widths it remains a horizontally scrollable table.
