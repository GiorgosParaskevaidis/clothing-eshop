import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { client, totp } from './auth-client.mjs';

const url = new URL(process.env.API_TEST_DB_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '13307' || !/^\/phase1_[a-f0-9]{12}_test$/.test(url.pathname))
  throw new Error('Use the isolated phase1 runner. Personal and online databases are forbidden.');
const db = await mysql.createConnection(process.env.API_TEST_DB_URL);
const guest = client(), admin = client();
const input = (paymentMethod = 'CashOnDelivery') => ({
  requestKey: randomUUID(), paymentMethod, email: 'manual-fixture@phase1.example',
  name: 'Manual fixture', phone: '2101234567', address: 'Fixture street', city: 'Athens',
  postalCode: '10563', country: 'GR', acceptTerms: true, items: [{ variantId: 'hood-S', quantity: 1 }],
});
const detail = async id => (await admin.request('/admin/operations/orders/' + id)).payload.order;
async function create(method) {
  const request = input(method), result = await guest.request('/checkout', request);
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  const [rows] = await db.execute('SELECT id FROM orders WHERE public_token=?', [result.payload.publicToken]);
  return { ...result.payload, id: rows[0].id, request };
}
const ship = order => admin.request('/admin/operations/orders/' + order.id + '/ship', {
  version: order.version, courier: 'Fixture courier', trackingNumber: 'FIXTURE', trackingUrl: '',
});
const confirm = (order, overrides = {}) => admin.request('/admin/operations/orders/' + order.id + '/confirm-payment', {
  version: order.version, amountCents: order.totalCents, reference: 'Fixture receipt only', ...overrides,
});

test('manual payment checkout and operator workflow', async t => {
  await guest.request('/checkout/context');
  if (process.env.API_TEST_BANK_UNCONFIGURED === 'true') {
    await t.test('missing Revolut details disable deposits and never reserve stock', async () => {
      const store = (await guest.request('/store')).payload;
      assert.equal(store.paymentMethods.find(method => method.id === 'BankTransfer').available, false);
      const [before] = await db.execute("SELECT available FROM variants WHERE id='hood-S'");
      assert.equal((await guest.request('/checkout', input('BankTransfer'))).response.status, 503);
      const [after] = await db.execute("SELECT available FROM variants WHERE id='hood-S'");
      assert.deepEqual(after, before);
      assert.equal((await guest.request('/checkout', input())).response.status, 200);
    });
    return;
  }
  const state = JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE, 'utf8'));
  // Wait for a new TOTP interval; the auth suite deliberately consumes the previous code.
  await new Promise(resolve => setTimeout(resolve, 30000 - Date.now() % 30000 + 100));
  const login = await admin.request('/admin/login', { email: process.env.API_TEST_ADMIN_EMAIL, password: process.env.API_TEST_ADMIN_PASSWORD });
  assert.equal((await admin.request('/auth/admin/mfa/verify', { challengeToken: login.payload.challengeToken, code: totp(state.adminKey) })).response.status, 200);

  await t.test('only the two explicit methods are accepted, regardless of legacy Store mode', async () => {
    const store = (await guest.request('/store')).payload;
    assert.equal(store.simulation, false);
    assert.deepEqual(store.paymentMethods.map(method => method.id), ['BankTransfer', 'CashOnDelivery']);
    for (const method of ['', 'Stripe', 'Simulation', 'card', 'PayPal', null])
      assert.equal((await guest.request('/checkout', input(method))).response.status, 400);
  });
  let cod;
  await t.test('COD is accepted unpaid, has no provider session, and retries return the same order', async () => {
    cod = await create();
    assert.ok(cod.checkoutUrl.startsWith(process.env.API_TEST_PUBLIC_URL + '/checkout/success?'));
    const receipt = (await guest.request('/orders/' + cod.publicToken)).payload;
    assert.equal(receipt.status, 'confirmed'); assert.equal(receipt.paymentStatus, 'pending');
    assert.equal(receipt.paymentMode, 'CashOnDelivery');
    assert.ok(receipt.paymentInstructions.includes('Cash on delivery'));
    const [rows] = await db.execute('SELECT stripe_session_id,reservation_status FROM orders WHERE id=?', [cod.id]);
    assert.equal(rows[0].stripe_session_id, null); assert.equal(rows[0].reservation_status, 'consumed');
    assert.equal((await guest.request('/checkout', cod.request)).payload.publicToken, cod.publicToken);
    assert.equal((await guest.request('/checkout', { ...cod.request, paymentMethod: 'BankTransfer' })).response.status, 409);
    assert.equal((await guest.request('/payments/simulation', { token: cod.publicToken })).response.status, 400);
  });
  await t.test('COD ships unpaid and collection is confirmed only after dispatch, with exact amount and version', async () => {
    let order = await detail(cod.id);
    assert.equal((await confirm(order)).response.status, 409);
    assert.equal((await ship(order)).response.status, 204);
    order = await detail(cod.id); assert.equal(order.paymentStatus, 'pending');
    assert.equal((await confirm(order, { amountCents: 1 })).response.status, 409);
    assert.equal((await confirm(order, { version: order.version - 1 })).response.status, 409);
    const anonymous = await guest.request('/admin/operations/orders/' + order.id + '/confirm-payment', { version: order.version, amountCents: order.totalCents, reference: 'forged' });
    assert.equal(anonymous.response.status, 401);
    assert.equal((await confirm(order)).response.status, 204);
    assert.equal((await confirm(order)).response.status, 409);
    order = await detail(cod.id); assert.equal(order.status, 'fulfilled'); assert.equal(order.paymentStatus, 'succeeded');
  });
  let bank;
  await t.test('deposit instructions are snapshotted and dispatch is blocked until receipt confirmation', async () => {
    bank = await create('BankTransfer');
    let order = await detail(bank.id);
    assert.equal(order.status, 'awaiting_payment'); assert.equal(order.paymentStatus, 'pending');
    assert.ok(order.paymentInstructions.includes('GB82WEST12345698765432'));
    assert.ok(order.paymentInstructions.includes(order.number));
    assert.equal((await ship(order)).response.status, 409);
    await db.execute('UPDATE orders SET expires_utc=DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 DAY) WHERE id=?', [order.id]);
    assert.equal((await guest.request('/checkout', bank.request)).payload.publicToken, bank.publicToken);
    assert.equal((await confirm(order)).response.status, 204);
    order = await detail(bank.id); assert.equal(order.status, 'paid'); assert.equal(order.paymentStatus, 'succeeded');
    assert.equal((await ship(order)).response.status, 204);
  });
  await t.test('both payment methods deliver buyer and admin creation emails once across checkout retries', async () => {
    for (const created of [cod, bank]) {
      const keys = ['created', 'admin-created'].map(suffix => 'email:order:' + created.id + ':' + suffix);
      const [before] = await db.query('SELECT id,dedup_key,protected_payload FROM background_jobs WHERE dedup_key IN (?) ORDER BY dedup_key', [keys]);
      assert.equal(before.length, 2);
      assert.equal((await guest.request('/checkout', created.request)).payload.publicToken, created.publicToken);
      const [after] = await db.query('SELECT id,dedup_key FROM background_jobs WHERE dedup_key IN (?) ORDER BY dedup_key', [keys]);
      assert.deepEqual(after, before.map(({ id, dedup_key }) => ({ id, dedup_key })));
      const order = await detail(created.id);
      for (const job of before) {
        assert.ok(!String(job.protected_payload).includes(created.request.email));
        let mail;
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          try { mail = JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR, job.id + '.json'), 'utf8')); break; }
          catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        assert.ok(mail, 'The isolated email worker must capture the queued message.');
        const isAdmin = job.dedup_key.endsWith(':admin-created');
        assert.equal(mail.email, isAdmin ? process.env.API_TEST_ADMIN_EMAIL : created.request.email);
        assert.equal(mail.purpose, isAdmin ? 'order-created-admin' : 'order-created');
        assert.ok(mail.text.includes(order.number));
        assert.ok(mail.text.includes((order.totalCents / 100).toFixed(2) + ' EUR'));
        assert.ok(mail.text.includes('1 × '));
        assert.ok(!mail.text.includes(created.publicToken));
        if (isAdmin) {
          assert.ok(mail.text.includes(created.request.phone));
          assert.ok(mail.text.includes(created.request.address));
          assert.ok(mail.text.includes('/admin/orders'));
          assert.ok(mail.text.includes(created.request.paymentMethod === 'BankTransfer' ? 'Αναμένεται κατάθεση' : 'Ανεξόφλητη αντικαταβολή'));
        } else {
          assert.ok(mail.text.includes(created.request.paymentMethod === 'BankTransfer' ? 'GB82WEST12345698765432' : 'Cash on delivery'));
        }
      }
    }
  });
  await t.test('new order notifications follow the current verified admin email, not legacy configuration', async () => {
    const changedEmail = 'changed-admin@phase1.example';
    await db.execute('UPDATE users SET email=? WHERE normalized_email=?', [changedEmail, process.env.API_TEST_ADMIN_EMAIL.toUpperCase()]);
    try {
      const created = await create();
      const [jobs] = await db.execute('SELECT id FROM background_jobs WHERE dedup_key=?', ['email:order:' + created.id + ':admin-created']);
      let mail;
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        try { mail = JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR, jobs[0].id + '.json'), 'utf8')); break; }
        catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      assert.equal(mail?.email, changedEmail);
    } finally {
      await db.execute('UPDATE users SET email=? WHERE normalized_email=?', [process.env.API_TEST_ADMIN_EMAIL, process.env.API_TEST_ADMIN_EMAIL.toUpperCase()]);
    }
  });
  await t.test('a missing admin recipient rejects checkout without an order, stock change or orphan email', async () => {
    const snapshot = async () => (await db.query("SELECT (SELECT COUNT(*) FROM orders) orders_count,(SELECT COUNT(*) FROM background_jobs WHERE dedup_key LIKE 'email:order:%') emails_count,(SELECT available FROM variants WHERE id='hood-S') stock"))[0];
    const before = await snapshot();
    await db.execute("UPDATE users SET enabled=FALSE WHERE id IN (SELECT user_id FROM user_roles WHERE role_id='admin')");
    try {
      for (const method of ['CashOnDelivery', 'BankTransfer'])
        assert.equal((await guest.request('/checkout', input(method))).response.status, 503);
      assert.deepEqual(await snapshot(), before);
    } finally {
      await db.execute("UPDATE users SET enabled=TRUE WHERE id IN (SELECT user_id FROM user_roles WHERE role_id='admin')");
    }
  });
  await t.test('unpaid orders cancel once, restoring inventory once and recording a reason', async () => {
    for (const method of ['CashOnDelivery', 'BankTransfer']) {
      const created = await create(method), order = await detail(created.id);
      const [before] = await db.execute("SELECT available FROM variants WHERE id='hood-S'");
      const cancel = () => admin.request('/admin/operations/orders/' + order.id + '/cancel', { version: order.version, reason: 'Fixture cancellation' });
      const results = await Promise.all([cancel(), cancel()]);
      assert.deepEqual(results.map(result => result.response.status).sort(), [204, 409]);
      const [after] = await db.execute("SELECT available FROM variants WHERE id='hood-S'");
      assert.equal(after[0].available, before[0].available + 1);
      assert.equal((await detail(order.id)).status, 'cancelled');
      assert.equal((await guest.request('/checkout', created.request)).response.status, 409);
    }
  });
  await t.test('manual refunds record money already returned, require fresh proof, and never enqueue provider work', async () => {
    const proof = await admin.request('/auth/admin/reauth', { password: process.env.API_TEST_ADMIN_PASSWORD });
    const refund = { requestKey: randomUUID(), amountCents: 1000, reason: 'Fixture completed transfer REF-1', challengeToken: proof.payload.challengeToken, code: state.adminCodes[0] };
    assert.equal((await admin.request('/admin/operations/orders/' + bank.id + '/refund', refund)).response.status, 202);
    assert.equal((await detail(bank.id)).paymentStatus, 'partially_refunded');
    const [rows] = await db.execute("SELECT id,state FROM refunds WHERE order_id=?", [bank.id]);
    assert.equal(rows.length, 1); assert.equal(rows[0].state, 'succeeded');
    const [jobs] = await db.execute("SELECT id FROM background_jobs WHERE dedup_key=?", ['refund:' + rows[0].id]);
    assert.equal(jobs.length, 0);
  });
});
test.after(() => db.end());
