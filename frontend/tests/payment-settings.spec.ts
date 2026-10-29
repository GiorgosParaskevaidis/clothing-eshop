import { test, expect, type Page } from '@playwright/test';
import type { PaymentSettings } from '../lib/types';

async function mockAdmin(page: Page, conflict = false, signedIn = true) {
  let saved: PaymentSettings = {
    bankTransferEnabled: false,
    accountHolder: '',
    iban: '',
    bic: '',
    version: 0,
  };
  const writes: Record<string, unknown>[] = [];
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === '/api/admin/session')
      return reply(signedIn ? { email: 'admin@fixture.example' } : {}, signedIn ? 200 : 401);
    if (path === '/api/security/csrf') return reply({ token: 'fixture-csrf' });
    if (path === '/api/auth/admin/reauth') return reply({ challengeToken: 'fixture-proof' });
    if (path === '/api/admin/payment-settings') {
      if (request.method() === 'GET') return reply(saved);
      const value = request.postDataJSON();
      writes.push(value);
      if (conflict)
        return reply(
          { message: 'Payment settings changed. Reload the saved settings and try again.' },
          409,
        );
      saved = {
        bankTransferEnabled: value.bankTransferEnabled,
        accountHolder: value.accountHolder.trim(),
        iban: value.iban.replaceAll(' ', '').toUpperCase(),
        bic: value.bic.trim().toUpperCase(),
        version: value.version + 1,
      };
      return reply(saved);
    }
    if (path === '/api/products') return reply([]);
    if (path === '/api/store')
      return reply({
        brand: 'thesamenot',
        salesEnabled: true,
        checkoutAvailable: true,
        dropOpensAt: '2020-01-01T00:00:00Z',
        paymentMethods: [],
        shippingCents: 400,
        freeShippingThresholdCents: 8000,
        preview: false,
        simulation: false,
        instagramUrl: '',
        contactEmail: '',
      });
    return reply({ message: 'Unmocked payment settings browser request: ' + path }, 500);
  });
  return writes;
}

async function enterDetails(page: Page) {
  await page
    .getByRole('checkbox', { name: 'Ενεργοποίηση τραπεζικής κατάθεσης', exact: true })
    .check();
  await page.getByLabel('Δικαιούχος λογαριασμού', { exact: true }).fill(' Fixture merchant ');
  await page.getByLabel('IBAN', { exact: true }).fill('gb82 west 1234 5698 7654 32');
  await page.getByLabel('BIC (προαιρετικό)', { exact: true }).fill('westgb2l');
  await page
    .getByLabel('Κωδικός πρόσβασης διαχειριστή', { exact: true })
    .fill('Fixture-password-only');
  await page
    .getByRole('button', { name: 'Επαλήθευση κωδικού για αποθήκευση', exact: true })
    .click();
  await expect(
    page.getByLabel('Νέος κωδικός εφαρμογής επαλήθευσης ή ανάκτησης', { exact: true }),
  ).toBeVisible();
}

test('admin payment form reviews details, saves with proof, reloads and supports both languages', async ({
  page,
}) => {
  const writes = await mockAdmin(page);
  await page.goto('/admin/payments');
  await expect(
    page.getByRole('heading', { name: 'Ρυθμίσεις πληρωμών', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ρυθμίσεις πληρωμών', exact: true })).toBeVisible();
  await enterDetails(page);
  await expect(page.getByLabel('Κωδικός πρόσβασης διαχειριστή', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('IBAN', { exact: true })).toBeDisabled();
  await page
    .getByLabel('Νέος κωδικός εφαρμογής επαλήθευσης ή ανάκτησης', { exact: true })
    .fill('fixture-code');
  await page.getByRole('button', { name: 'Αποθήκευση ρυθμίσεων πληρωμών', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Οι ρυθμίσεις πληρωμών αποθηκεύτηκαν.' }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({
    bankTransferEnabled: true,
    version: 0,
    challengeToken: 'fixture-proof',
    code: 'fixture-code',
  });
  expect(writes[0]).not.toHaveProperty('password');
  await expect(page.getByLabel('IBAN', { exact: true })).toHaveValue('GB82WEST12345698765432');
  await page.reload();
  await expect(page.getByLabel('Δικαιούχος λογαριασμού', { exact: true })).toHaveValue(
    'Fixture merchant',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Ενεργοποίηση τραπεζικής κατάθεσης', exact: true }),
  ).toBeChecked();
  await page.getByRole('combobox', { name: 'Ελληνικά / English', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Payment settings', exact: true })).toBeVisible();
  await expect(page.getByLabel('Account holder', { exact: true })).toHaveValue('Fixture merchant');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('version conflict preserves the unsaved draft and requires a new proof', async ({ page }) => {
  await mockAdmin(page, true);
  await page.goto('/admin/payments');
  await enterDetails(page);
  await page
    .getByLabel('Νέος κωδικός εφαρμογής επαλήθευσης ή ανάκτησης', { exact: true })
    .fill('fixture-code');
  await page.getByRole('button', { name: 'Αποθήκευση ρυθμίσεων πληρωμών', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Οι ρυθμίσεις πληρωμών άλλαξαν.',
  );
  await expect(page.getByLabel('Δικαιούχος λογαριασμού', { exact: true })).toHaveValue(
    ' Fixture merchant ',
  );
  await expect(page.getByLabel('IBAN', { exact: true })).toBeEnabled();
  await expect(
    page.getByLabel('Νέος κωδικός εφαρμογής επαλήθευσης ή ανάκτησης', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Φόρτωση αποθηκευμένων ρυθμίσεων', exact: true }).click();
  await expect(page.getByLabel('IBAN', { exact: true })).toHaveValue('');
});

test('bank fields are hidden until admin authentication succeeds', async ({ page }) => {
  await mockAdmin(page, false, false);
  await page.goto('/admin/payments');
  await expect(page.getByLabel('Δικαιούχος λογαριασμού', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});
