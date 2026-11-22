const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

// All fixtures are literal in-memory values. Never load the tracked database.
const examples = [
  { id: 1001, coupon: '', items: [[8, '0902', 140, 2], [2, '0713', 165, 2]], ledger: [610, 0, 66.9, 676.9], current: [610, 0, 109.8, 719.8] },
  { id: 1002, coupon: 'SAVE10', items: [[1, '1006', 640, 1], [4, '1512', 190, 2]], ledger: [1020, 102, 45.9, 963.9], current: [1020, 120.36, 183.6, 1083.24] },
  { id: 1003, coupon: 'FLAT50', items: [[7, '0405', 260, 1], [8, '0902', 140, 1]], ledger: [400, 50, 49.35, 399.35], current: [400, 50, 72, 422] },
  { id: 1004, coupon: 'SAVE10', items: [[5, '1508', 1120, 2]], ledger: [2240, 150, 104.5, 2194.5], current: [2240, 264.32, 403.2, 2378.88] },
  { id: 1005, coupon: 'FLAT50', items: [[1, '1006', 640, 1], [12, '2106', 180, 2]], ledger: [1000, 50, 91.96, 1041.96], current: [1000, 50, 180, 1130] },
  { id: 1006, coupon: 'WELCOME', items: [[6, '0405', 450, 2], [9, '0901', 310, 1]], ledger: [1210, 60.5, 155.61, 1305.11], current: [1210, 71.39, 217.8, 1356.41] },
  { id: 1007, coupon: '', items: [[6, '0405', 450, 2], [4, '1512', 190, 2]], ledger: [1280, 0, 127, 1407], current: [1280, 0, 230.4, 1510.4] },
  { id: 1008, coupon: '', items: [[8, '0902', 140, 1], [12, '2106', 180, 2]], ledger: [500, 0, 90, 590], current: [500, 0, 90, 590] }
];

function makeOrder(example) {
  return {
    id: example.id,
    date: '15/03/2022',
    customer: 'Workshop customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: example.coupon,
    items: example.items.map(function (row) {
      return { id: row[0], sku: 'SKU-' + row[0], name: 'Item ' + row[0], hsn: row[1], price: row[2], qty: row[3] };
    }),
    subtotal: example.ledger[0],
    discount: example.ledger[1],
    tax: example.ledger[2],
    total: example.ledger[3]
  };
}

function totals(calc) {
  return [calc.subtotal, calc.discount, calc.tax, calc.total];
}

function singleItem(price, extra, coupon) {
  return {
    id: 2001,
    date: '15/03/2022',
    customer: 'Workshop customer',
    items: [Object.assign({ name: 'Fixture item', price: price, qty: 1 }, extra)],
    coupon: coupon || ''
  };
}

test('checkout reference totals match the eight literal workshop examples', function () {
  for (const example of examples) {
    const order = makeOrder(example);
    assert.deepEqual(totals(pricing.computeTotals(order.items, order.coupon)), example.ledger, 'order #' + order.id);
  }
});

for (const example of examples) {
  const name = example.id === 1008
    ? '18% items without a coupon match checkout (#1008)'
    : 'CURRENT BEHAVIOUR: invoice differs from checkout (#' + example.id + ')';
  test(name, function () {
    assert.deepEqual(totals(invoice.computeInvoiceFigures(makeOrder(example))), example.current);
  });
}

test('missing items produce an empty zero-valued invoice', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('line rows preserve metadata and use dashes for absent SKU and HSN', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(100, { gstRate: 18 }));
  assert.deepEqual(calc.rows, [{
    name: 'Fixture item', sku: '-', hsn: '-', qty: 1, price: 100,
    gstPercent: 18, line: 100, lineTax: 18
  }]);
});

test('explicit percentage GST rates are honored', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(100, { gstRate: 5, hsn: '0902' }));
  assert.deepEqual(totals(calc), [100, 0, 5, 105]);
  assert.equal(calc.rows[0].gstPercent, 5);
});

test('CURRENT BEHAVIOUR: decimal GST rates are divided by 100 again', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(100, { gstRate: 0.12 }));
  assert.deepEqual(totals(calc), [100, 0, 0.12, 100.12]);
  assert.equal(calc.rows[0].gstPercent, 0);
});

test('CURRENT BEHAVIOUR: explicit zero GST falls back to 18%', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(100, { gstRate: 0, hsn: '0902' }));
  assert.deepEqual(totals(calc), [100, 0, 18, 118]);
});

test('unknown HSN codes use the configured fallback rate', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(100, { hsn: '9999' }));
  assert.deepEqual(totals(calc), [100, 0, 18, 118]);
});

test('CURRENT BEHAVIOUR: percent discounts include tax rather than reducing the taxable value', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(1000, { hsn: '0902' }, 'SAVE10'));
  assert.deepEqual(totals(calc), [1000, 118, 180, 1062]);
});

test('CURRENT BEHAVIOUR: percent coupons apply below their minimum subtotal', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(100, {}, 'SAVE10'));
  assert.deepEqual(totals(calc), [100, 11.8, 18, 106.2]);
});

test('CURRENT BEHAVIOUR: inactive coupons still discount invoices', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(1200, {}, 'DIWALI20'));
  assert.deepEqual(totals(calc), [1200, 283.2, 216, 1132.8]);
});

test('CURRENT BEHAVIOUR: coupon codes are not trimmed or normalized', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(1000, {}, ' save10 '));
  assert.deepEqual(totals(calc), [1000, 0, 180, 1180]);
});

test('CURRENT BEHAVIOUR: flat discounts below the minimum can create negative totals', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(20, {}, 'FLAT50'));
  assert.deepEqual(totals(calc), [20, 50, 3.6, -26.4]);
});

test('unknown coupons leave the invoice undiscounted', function () {
  assert.deepEqual(totals(invoice.computeInvoiceFigures(singleItem(100, {}, 'UNKNOWN'))), [100, 0, 18, 118]);
});

test('CURRENT BEHAVIOUR: aggregate tax rounding can disagree with the sum of invoice row taxes', function () {
  const order = { items: [{ name: 'A', price: 0.03, qty: 1 }, { name: 'B', price: 0.03, qty: 1 }] };
  const calc = invoice.computeInvoiceFigures(order);
  assert.deepEqual(totals(calc), [0.06, 0, 0.01, 0.07]);
  assert.deepEqual(calc.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('CGST and SGST split an odd tax cent without losing it', function () {
  const calc = invoice.computeInvoiceFigures(singleItem(1, { gstRate: 5 }));
  assert.deepEqual([calc.tax, calc.cgst, calc.sgst], [0.05, 0.03, 0.02]);
});

test('computation and rendering do not mutate the input order', function () {
  const order = makeOrder(examples[1]);
  const original = structuredClone(order);
  invoice.computeInvoiceFigures(order);
  invoice.render(order);
  assert.deepEqual(order, original);
});

test('render escapes customer and item text while preserving the printable invoice', function () {
  const order = makeOrder(examples[7]);
  order.customer = '<script>alert(1)</script> & Customer';
  order.items[0].name = '<b>Tea</b>';
  const html = invoice.render(order);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Customer'));
  assert.ok(html.includes('&lt;b&gt;Tea&lt;/b&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('INV-1008'));
  assert.ok(html.includes('window.print()'));
  assert.ok(html.includes('₹590.00'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: the printed invoice warns about order #1002', function () {
  const html = invoice.render(makeOrder(examples[1]));
  assert.ok(html.includes('Accountant Reconciliation Notice:'));
  assert.ok(html.includes('₹1083.24'));
  assert.ok(html.includes('₹963.90'));
});

test('reconciliation reports genuinely inconsistent stored totals', function () {
  const order = makeOrder(examples[7]);
  order.total = 1;
  const result = reports.getGstReconciliation({ orders: [order] });
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.rows[0].delta, 589);
  assert.ok(invoice.render(order).includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: reconciliation flags seven of the eight literal orders', function () {
  const result = reports.getGstReconciliation({ orders: examples.map(makeOrder) });
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 7);
  assert.equal(result.totalDelta, 612.01);
});
