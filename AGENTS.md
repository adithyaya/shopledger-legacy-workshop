# ShopLedger contributor instructions

## Stack and module map
- Node.js, CommonJS JavaScript, Express 4 and body-parser.
- `server.js` serves `public/`, mounts four routers under `/api`, and renders printable invoices at `/orders/:id/invoice`.
- `public/index.html`, `public/js/app.js`, `public/css/style.css`: browser POS, order history, Khata and inventory/GST audit.
- `routes/products.js`, `routes/orders.js`, `routes/customers.js`, `routes/reports.js`: HTTP request handling.
- `lib/inventory.js`: stock and reservations; `lib/orders.js`: order creation, listing and cancellation.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout totals, GST slabs and coupon rules.
- `lib/invoice.js`: printable invoice figures and HTML; `lib/reports.js`: dashboard and reconciliation.
- `lib/ledger.js`: Khata credit and settlement balances; `lib/dates.js`: date utilities.
- `lib/store.js`: synchronous JSON persistence and audit entries in `data/db.json`.
- `config.js`: application settings, shop metadata, tax slabs and coupon definitions.

## Commands
- Workshop runtime requirement: Node.js 22 or newer.
- `npm install`: install the existing dependencies. Do not commit the generated `package-lock.json`.
- `npm start`: start the app at http://localhost:3000 by default; `PORT` overrides the port.
- `node --test`: run the built-in Node test runner. The existing `npm test` script is a placeholder and exits with an error.
- `git diff --check`: check whitespace in the patch.

## Change rules
1. Write and run characterization tests before changing behavior. Mark tests that preserve known incorrect behavior with `CURRENT BEHAVIOUR`. Show a regression test failing before applying the fix.
2. Change only the production module or modules involved in the selected ticket. Keep supporting tests and documentation focused, and make the smallest fix.
3. Tests use in-memory fixtures only. They must never read or write `data/db.json`, or import `lib/store.js`. Reproduce the running app in a temporary project copy so the tracked database stays unchanged.
4. Add no dependencies. Use `node:test` and `node:assert/strict`.

Run all tests and review the diff before opening a pull request. Use a `fix/` branch and leave the pull request unmerged.
