import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { client } from './auth-client.mjs';

const url = new URL(process.env.API_TEST_DB_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '13307' || !/^\/phase1_[a-f0-9]{12}_test$/.test(url.pathname))
  throw new Error('Use the isolated phase1 runner. Personal and online databases are forbidden.');
const db = await mysql.createConnection(process.env.API_TEST_DB_URL);
const state = JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE, 'utf8'));
const admin = client(), guest = client(), customer = client();
let codes;
for (const pair of state.customerCookie.split('; ')) {
  const index = pair.indexOf('='); customer.cookies.set(pair.slice(0, index), pair.slice(index + 1));
}
const get = async () => (await admin.request('/admin/payment-settings')).payload;
const storeBank = async () => (await guest.request('/store')).payload.paymentMethods.find(method => method.id === 'BankTransfer');
const orderInput = () => ({ requestKey: randomUUID(), paymentMethod: 'BankTransfer', email: 'settings@phase1.example',
  name: 'Payment settings fixture', phone: '', address: 'Fixture street', city: 'Athens', postalCode: '10563',
  country: 'GR', acceptTerms: true, items: [{ variantId: 'hood-XL', quantity: 1 }] });
async function proof(index) {
  const result = await admin.request('/auth/admin/reauth', { password: process.env.API_TEST_ADMIN_PASSWORD });
  assert.equal(result.response.status, 200);
  return { challengeToken: result.payload.challengeToken, code: codes[index] };
}
const save = (value, proof) => admin.request('/admin/payment-settings', { ...value, ...proof }, 'PUT');

test('database payment settings, protected changes and immutable instructions', async t => {
  const login = await admin.request('/admin/login', { email: process.env.API_TEST_ADMIN_EMAIL, password: process.env.API_TEST_ADMIN_PASSWORD });
  assert.equal(login.response.status, 200);
  assert.equal((await admin.request('/auth/admin/mfa/verify', { challengeToken: login.payload.challengeToken, code: state.adminCodes[1] })).response.status, 200);
  // Independent fresh fixture codes, including when broader operations tests used their own codes.
  const renewal = await admin.request('/auth/admin/reauth', { password: process.env.API_TEST_ADMIN_PASSWORD });
  const recovery = await admin.request('/auth/admin/recovery-codes', {
    challengeToken: renewal.payload.challengeToken, code: state.adminCodes[2],
  });
  assert.equal(recovery.response.status, 200); codes = recovery.payload.recoveryCodes;
  await guest.request('/checkout/context');
  let current = await get();
  const initial = { ...current };
  const oldRequest = orderInput();
  const created = await guest.request('/checkout', oldRequest);
  assert.equal(created.response.status, 200);
  const oldReceipt = (await guest.request('/orders/' + created.payload.publicToken)).payload;
  assert.ok(oldReceipt.paymentInstructions.includes(initial.iban));

  await t.test('admin policy, customer isolation, CSRF and fresh verification protect writes', async () => {
    assert.equal((await guest.request('/admin/payment-settings')).response.status, 401);
    assert.equal((await guest.request('/admin/payment-settings', current, 'PUT')).response.status, 401);
    assert.equal((await customer.request('/admin/payment-settings')).response.status, 401);
    assert.equal((await customer.request('/admin/payment-settings', current, 'PUT')).response.status, 401);
    assert.equal((await admin.request('/admin/payment-settings', current, 'PUT', { noCsrf: true })).response.status, 403);
    assert.equal((await save(current, { challengeToken: '', code: '' })).response.status, 400);
    assert.equal((await save(current, { challengeToken: '0'.repeat(64), code: '123456' })).response.status, 401);
    assert.deepEqual(await get(), initial);
    const publicStore = (await guest.request('/store')).payload;
    assert.equal(JSON.stringify(publicStore).includes(initial.iban), false);
  });

  await t.test('invalid IBAN, BIC, line injection, missing enabled details and negative versions never save', async () => {
    for (const change of [{ iban: 'GB82WEST12345698765433' }, { bic: 'BAD' },
      { accountHolder: 'Holder\nPayment reference: forged' }, { iban: '', accountHolder: '' },
      { version: -1 }, { accountHolder: 'A'.repeat(141) }]) {
      assert.equal((await save({ ...current, ...change }, { challengeToken: '', code: '' })).response.status, 400);
    }
    assert.deepEqual(await get(), initial);
  });

  await t.test('saved details normalize and take effect immediately; old receipts and retries preserve their snapshot', async () => {
    const token = await proof(2);
    const changed = await save({ ...current, accountHolder: ' Updated fixture merchant ',
      iban: 'de89 3704 0044 0532 0130 00', bic: 'testdeffxxx' }, token);
    assert.equal(changed.response.status, 200);
    current = changed.payload;
    assert.equal(current.accountHolder, 'Updated fixture merchant');
    assert.equal(current.iban, 'DE89370400440532013000');
    assert.equal(current.bic, 'TESTDEFFXXX');
    assert.equal(current.version, initial.version + 1);
    assert.equal((await storeBank()).available, true);
    const fresh = await guest.request('/checkout', orderInput());
    assert.equal(fresh.response.status, 200);
    const receipt = (await guest.request('/orders/' + fresh.payload.publicToken)).payload;
    assert.ok(receipt.paymentInstructions.includes(current.iban));
    assert.ok(receipt.paymentInstructions.includes(current.accountHolder));
    assert.ok(receipt.paymentInstructions.includes(current.bic));
    assert.deepEqual((await guest.request('/orders/' + created.payload.publicToken)).payload, oldReceipt);
    assert.equal((await guest.request('/checkout', oldRequest)).payload.publicToken, created.payload.publicToken);
    assert.equal((await save(current, token)).response.status, 401);
    assert.equal((await get()).version, current.version);
  });

  await t.test('stale versions and concurrent admin updates cannot overwrite a newer saved account', async () => {
    assert.equal((await save({ ...current, version: initial.version }, await proof(3))).response.status, 409);
    const before = current.version;
    const a = await proof(4), b = await proof(5);
    const results = await Promise.all([
      save({ ...current, accountHolder: 'Concurrent fixture A' }, a),
      save({ ...current, accountHolder: 'Concurrent fixture B' }, b),
    ]);
    assert.deepEqual(results.map(result => result.response.status).sort(), [200, 409]);
    current = await get();
    assert.equal(current.version, before + 1);
    assert.ok(['Concurrent fixture A', 'Concurrent fixture B'].includes(current.accountHolder));
    const [audit] = await db.execute("SELECT COUNT(*) count FROM audit_log WHERE action='payment_settings.updated'");
    assert.equal(audit[0].count, 2);
  });

  await t.test('disabling deposits keeps COD available, blocks new reservations, and preserves existing orders', async () => {
    const disabled = await save({ ...current, bankTransferEnabled: false }, await proof(6));
    assert.equal(disabled.response.status, 200); current = disabled.payload;
    assert.equal((await storeBank()).available, false);
    assert.equal((await storeBank()).unavailableReason, 'Disabled');
    const [before] = await db.execute("SELECT available,version FROM variants WHERE id='hood-XL'");
    assert.equal((await guest.request('/checkout', orderInput())).response.status, 503);
    const [after] = await db.execute("SELECT available,version FROM variants WHERE id='hood-XL'");
    assert.deepEqual(after, before);
    assert.equal((await guest.request('/checkout', oldRequest)).payload.publicToken, created.payload.publicToken);
    assert.deepEqual((await guest.request('/orders/' + created.payload.publicToken)).payload, oldReceipt);
    const cod = await guest.request('/checkout', { ...orderInput(), paymentMethod: 'CashOnDelivery' });
    assert.equal(cod.response.status, 200);
  });

  await t.test('disabled bank details can be cleared and BIC is optional; legacy config never re-enables deposits', async () => {
    const cleared = await save({ ...current, accountHolder: '', iban: '', bic: '' }, await proof(7));
    assert.equal(cleared.response.status, 200); current = cleared.payload;
    assert.equal(current.bankTransferEnabled, false);
    assert.equal((await storeBank()).unavailableReason, 'NotConfigured');
    assert.equal((await storeBank()).available, false);
    assert.equal((await save({ ...current, bankTransferEnabled: true }, { challengeToken: '', code: '' })).response.status, 400);
    // Saving an enabled account without BIC is supported by the same real endpoint.
    const enabled = await save({ ...current, bankTransferEnabled: true, accountHolder: initial.accountHolder,
      iban: initial.iban }, await proof(8));
    assert.equal(enabled.response.status, 200);
    assert.equal(enabled.payload.bic, '');
    assert.equal((await storeBank()).available, true);
    assert.equal((await save({ ...enabled.payload, bankTransferEnabled: false }, await proof(9))).response.status, 200);
    state.paymentSettings = await get();
    state.adminCodes = codes;
    await writeFile(process.env.API_TEST_AUTH_STATE, JSON.stringify(state));
  });
});

test.after(() => db.end());
