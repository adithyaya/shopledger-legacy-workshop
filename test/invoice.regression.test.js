const test = require('node:test');
const assert = require('node:assert/strict');
const invoice = require('../lib/invoice');

test('regression: order #1002 uses 5% HSN GST after its SAVE10 discount', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Sunflower oil', hsn: '1512', price: 190, qty: 2 }
    ]
  });
  assert.deepEqual(
    [result.subtotal, result.discount, result.tax, result.total],
    [1020, 102, 45.9, 963.9]
  );
  assert.deepEqual(result.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 28.8], [5, 17.1]]);
  assert.deepEqual([result.cgst, result.sgst], [22.95, 22.95]);
});

test('regression: order #1004 caps SAVE10 at 150 before calculating 5% GST', function () {
  const result = invoice.computeInvoiceFigures({
    coupon: 'SAVE10',
    items: [{ name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }]
  });
  assert.deepEqual(
    [result.subtotal, result.discount, result.tax, result.total],
    [2240, 150, 104.5, 2194.5]
  );
  assert.deepEqual([result.rows[0].gstPercent, result.rows[0].lineTax], [5, 104.5]);
});

test('regression: mixed 5% and 12% HSN lines retain their GST breakdown without coupons', function () {
  const result = invoice.computeInvoiceFigures({
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 100, qty: 1 }
    ]
  });
  assert.deepEqual(
    [result.subtotal, result.discount, result.tax, result.total],
    [200, 0, 17, 217]
  );
  assert.deepEqual(result.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }), [[5, 5], [12, 12]]);
});
