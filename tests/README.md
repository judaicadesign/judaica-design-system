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
