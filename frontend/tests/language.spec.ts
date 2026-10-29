import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { CheckoutQuote, Product, Receipt, Store } from '../lib/types';

// Browser-only fixtures: no order, account, email or database mutation reaches the API.
const product: Product = {
  id: 'hood',
  slug: 'ghost-hoodie',
  name: 'Ghost Hoodie',
  description: '',
  priceCents: 5900,
  currency: 'EUR',
  status: 'published',
  active: true,
  material: '',
  care: '',
  sizeGuide: '',
  inventoryMode: 'limited',
  version: 1,
  categories: [],
  images: [],
  edition: 50,
  frontImage: '/images/hood_front.jpg',
  backImage: '/images/hood_back.jpg',
  variants: [
    {
      id: 'hood-L',
      productId: 'hood',
      size: 'L',
      sku: 'HOOD-L',
      color: 'Black',
      active: true,
      available: 4,
      version: 1,
    },
  ],
};
const store: Store = {
  brand: 'thesamenot',
  preview: false,
  dropOpensAt: '2026-01-01T00:00:00Z',
  salesEnabled: true,
  checkoutAvailable: true,
  simulation: false,
  shippingCents: 400,
  freeShippingThresholdCents: 8000,
  instagramUrl: '',
  contactEmail: '',
  paymentMethods: [
    { id: 'BankTransfer', name: 'Bank transfer to Revolut', available: true },
    { id: 'CashOnDelivery', name: 'Cash on delivery', available: true },
  ],
};
const quote: CheckoutQuote = {
  id: 'language-quote',
  subtotalCents: 5900,
  shippingCents: 400,
  totalCents: 6300,
  expiresUtc: '2099-01-01T00:00:00Z',
  methodName: 'Delivery in Greece',
  currency: 'EUR',
  version: 1,
  netCents: null,
  taxCents: null,
  taxPolicyVersion: 'fixture',
};
const bankInstructions =
  'Bank transfer to Revolut\nAccount holder: Fixture Merchant\nIBAN: GB82WEST12345698765432\nBIC: TESTBIC\nAmount: EUR 63.00\nPayment reference: TSN-LANGUAGE\nDispatch follows confirmation of the deposit by the store.';
const receipt: Receipt = {
  number: 'TSN-LANGUAGE',
  status: 'awaiting_payment',
  paymentMode: 'BankTransfer',
  paymentStatus: 'pending',
  paymentInstructions: bankInstructions,
  totalCents: 6300,
  shippingCents: 400,
  items: [
    {
      id: 1,
      variantId: 'hood-L',
      productSlug: 'ghost-hoodie',
      sku: 'HOOD-L',
      color: 'Black',
      imageUrl: '/images/hood_front.jpg',
      productName: 'Ghost Hoodie',
      size: 'L',
      quantity: 1,
      unitPriceCents: 5900,
    },
  ],
};

async function fixtures(page: Page, options: { bankReady?: boolean; receipt?: Receipt } = {}) {
  const submissions: unknown[] = [];
  // No external font dependency in behavioral tests; Edge visual QA uses the real typography.
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === '/api/products' || path === '/api/basket/products') return reply([product]);
    if (path === '/api/store')
      return reply({
        ...store,
        paymentMethods: store.paymentMethods.map((method) => ({
          ...method,
          available: method.id !== 'BankTransfer' || options.bankReady !== false,
        })),
      });
    if (path === '/api/security/csrf') return reply({ token: 'browser-fixture-only' });
    if (path === '/api/checkout/context') return reply({ customer: false, email: null });
    if (path === '/api/checkout/quote') return reply(quote);
    if (path === '/api/checkout') {
      submissions.push(route.request().postDataJSON());
      return reply(
        {
          message:
            'Your checkout quote changed or expired. Review the new total and confirm again.',
        },
        409,
      );
    }
    if (path.startsWith('/api/orders/')) return reply(options.receipt ?? receipt);
    if (path === '/api/auth/session')
      return reply({
        id: 'language-customer',
        email: 'language@example.test',
        displayName: 'Fixture Customer',
        emailConfirmed: true,
        scope: 'Customer',
      });
    if (path === '/api/account')
      return reply({
        id: 'language-customer',
        email: 'language@example.test',
        displayName: 'Fixture Customer',
        version: 1,
      });
    if (path === '/api/account/addresses') return reply([]);
    if (path === '/api/account/orders')
      return reply({ items: [], total: 0, page: 1, pageSize: 20 });
    if (path === '/api/auth/security') return reply({ mfaEnabled: false, hasPassword: true });
    return reply({ message: 'Unmocked request in language test: ' + path }, 500);
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('tsn_cart_v1'))
      localStorage.setItem('tsn_cart_v1', JSON.stringify([{ variantId: 'hood-L', quantity: 1 }]));
  });
  return submissions;
}
const language = (page: Page) =>
  page.getByRole('combobox', { name: 'Ελληνικά / English', exact: true });
async function noOverflow(page: Page) {
  await expect
    .poll(async () => {
      try {
        return await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      } catch (error) {
        if (error instanceof Error && error.message.includes('Execution context was destroyed'))
          return false;
        throw error;
      }
    })
    .toBe(true);
  await expect(language(page)).toBeVisible();
}

test('Greek is the default; English persists in SSR, catalog navigation and reload', async ({
  page,
  request,
  baseURL,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const html = await (await request.get('/')).text();
  expect(html).toContain('<html lang="el"');
  expect(html).toContain('Τα προϊόντα');
  await fixtures(page);
  await page.goto('/shop');
  await expect(page.getByRole('heading', { name: 'Κατάστημα', exact: true })).toBeVisible();
  await expect(page.getByLabel('Αναζήτηση', { exact: true })).toBeVisible();
  await page.getByLabel('Αναζήτηση', { exact: true }).fill('Ghost');
  await language(page).selectOption('en');
  await expect(page.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
  await expect(page.getByLabel('Search', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Search', { exact: true })).toHaveValue('Ghost');
  await page.reload();
  await expect(language(page)).toHaveValue('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const cookies = await page.context().cookies(baseURL);
  expect(cookies.find((cookie) => cookie.name === 'tsn_language')?.value).toBe('en');
  const english = await page.context().request.get('/');
  expect(await english.text()).toContain('<html lang="en"');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The pieces', exact: true })).toBeVisible();
  await language(page).selectOption('el');
  await expect(page.getByRole('heading', { name: 'Τα προϊόντα', exact: true })).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('checkout language preserves basket, input, consent, payment method and attempt key', async ({
  page,
}) => {
  test.setTimeout(90000);
  const submissions = await fixtures(page);
  await page.goto('/checkout');
  await expect(
    page.getByRole('heading', { name: 'Ολοκλήρωση παραγγελίας', exact: true }),
  ).toBeVisible();
  const payment = page.getByRole('combobox', { name: 'Τρόπος πληρωμής', exact: true });
  await expect(payment.locator('option')).toHaveText([
    'Τραπεζική κατάθεση σε Revolut',
    'Αντικαταβολή',
  ]);
  await page.getByLabel('Ονοματεπώνυμο', { exact: true }).fill('Δοκιμή Γλώσσας');
  await page.getByLabel('Email', { exact: true }).fill('language@example.test');
  await page.getByLabel('Οδός και αριθμός', { exact: true }).fill('Οδός Δοκιμής 1');
  await page.getByLabel('Πόλη', { exact: true }).fill('Αθήνα');
  await page.getByLabel('Ταχυδρομικός κώδικας', { exact: true }).fill('10563');
  await payment.selectOption('BankTransfer');
  await page.getByRole('checkbox', { name: /Αποδέχομαι/ }).check();
  const attempt = () =>
    page.evaluate(
      () => JSON.parse(sessionStorage.getItem('tsn_checkout_attempt_v1') ?? '{}').requestKey,
    );
  await expect.poll(attempt).toBeTruthy();
  const before = await attempt();
  await language(page).selectOption('en');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Δοκιμή Γλώσσας');
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('Οδός Δοκιμής 1');
  await expect(page.getByLabel('Country', { exact: true })).toHaveValue('Greece');
  await expect(page.getByLabel('Payment method', { exact: true })).toHaveValue('BankTransfer');
  await expect(page.getByRole('checkbox', { name: /I accept/ })).toBeChecked();
  expect(await attempt()).toBe(before);
  await language(page).selectOption('el');
  await expect(page.getByLabel('Χώρα', { exact: true })).toHaveValue('Ελλάδα');
  await expect(page.getByLabel('Ονοματεπώνυμο', { exact: true })).toHaveValue('Δοκιμή Γλώσσας');
  expect(await attempt()).toBe(before);
  await noOverflow(page);
  const accessibility = await new AxeBuilder({ page }).include('header').include('main').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole('button', { name: 'Υποβολή παραγγελίας', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Η προσφορά άλλαξε ή έληξε.',
  );
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    requestKey: before,
    paymentMethod: 'BankTransfer',
    country: 'GR',
    name: 'Δοκιμή Γλώσσας',
    items: [{ variantId: 'hood-L', quantity: 1 }],
    acceptTerms: true,
  });
  await language(page).selectOption('en');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Your checkout quote changed or expired.',
  );
  await expect(page.getByLabel('Payment method', { exact: true })).toHaveValue('BankTransfer');
});

test('unconfigured Revolut remains disabled in both languages; COD remains available', async ({
  page,
}) => {
  await fixtures(page, { bankReady: false });
  await page.goto('/checkout');
  const payment = page.getByRole('combobox', { name: 'Τρόπος πληρωμής', exact: true });
  await expect(payment).toHaveValue('CashOnDelivery');
  await expect(payment.locator('option[value="BankTransfer"]')).toHaveAttribute('disabled', '');
  await expect(
    page.getByText(
      'Η τραπεζική κατάθεση θα είναι διαθέσιμη μόλις προστεθούν τα στοιχεία του λογαριασμού μας στη Revolut.',
    ),
  ).toBeVisible();
  await language(page).selectOption('en');
  await expect(
    page.getByLabel('Payment method', { exact: true }).locator('option[value="BankTransfer"]'),
  ).toHaveAttribute('disabled', '');
  await expect(page.getByLabel('Payment method', { exact: true })).toHaveValue('CashOnDelivery');
  await noOverflow(page);
});

test('Revolut receipt translates labels while preserving payee, IBAN, amount and reference', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/checkout/success?token=language-fixture');
  await expect(
    page.getByRole('heading', { name: 'Η παραγγελία σου καταχωρίστηκε.', exact: true }),
  ).toBeVisible();
  const instructions = page.locator('.preserve-lines');
  await expect(instructions).toContainText('Δικαιούχος: Fixture Merchant');
  await expect(instructions).toContainText('IBAN: GB82WEST12345698765432');
  await expect(instructions).toContainText('Ποσό: EUR 63.00');
  await expect(instructions).toContainText('Αιτιολογία κατάθεσης: TSN-LANGUAGE');
  await expect(page.getByText(/Πληρωμή: Σε αναμονή/)).toBeVisible();
  await language(page).selectOption('en');
  await expect(instructions).toHaveText(bankInstructions);
  await page.reload();
  await expect(instructions).toHaveText(bankInstructions);
  await noOverflow(page);
});

test('COD receipt and pending payment are translated without presenting the order as paid', async ({
  page,
}) => {
  await fixtures(page, {
    receipt: {
      ...receipt,
      status: 'confirmed',
      paymentMode: 'CashOnDelivery',
      paymentInstructions:
        'Cash on delivery. Pay the total to the courier when your order is delivered.\nAmount: EUR 63.00',
    },
  });
  await page.goto('/checkout/success?token=language-fixture');
  await expect(page.getByText(/Τρόπος πληρωμής: Αντικαταβολή/)).toBeVisible();
  await expect(page.getByText(/Πληρωμή: Σε αναμονή/)).toBeVisible();
  await expect(
    page.getByText('Η παραγγελία σου καταχωρίστηκε. Θα πληρώσεις στον courier κατά την παράδοση.'),
  ).toBeVisible();
  await expect(page.locator('.preserve-lines')).toContainText('Ποσό: EUR 63.00');
  await language(page).selectOption('en');
  await expect(page.getByText(/Payment method: Cash on delivery/)).toBeVisible();
  await noOverflow(page);
});

test('customer account, addresses and orders share the selected language', async ({ page }) => {
  test.setTimeout(90000);
  await fixtures(page);
  await page.goto('/account/addresses');
  await expect(
    page.getByRole('heading', { name: 'Οι διευθύνσεις σου', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Όνομα διεύθυνσης', { exact: true })).toBeVisible();
  await language(page).selectOption('en');
  await expect(page.getByLabel('Address label', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your orders', exact: true })).toBeVisible();
  await language(page).selectOption('el');
  await expect(
    page.getByRole('heading', { name: 'Οι παραγγελίες σου', exact: true }),
  ).toBeVisible();
  await noOverflow(page);
});

test('public account entry, guest access, returns, policies, newsletter and 404 are bilingual', async ({
  page,
}) => {
  test.setTimeout(120000);
  await fixtures(page);
  for (const [url, greek, english] of [
    ['/account/login', 'Σύνδεση', 'Sign in'],
    ['/order-access', 'Παραγγελία επισκέπτη', 'Guest order access'],
    ['/returns', 'Επιστροφές και υπαναχώρηση', 'Returns & withdrawal'],
    ['/policies/terms', 'Όροι', 'Terms'],
    ['/newsletter/confirm', 'Επιβεβαίωση εγγραφής', 'Confirm subscription'],
    ['/missing-language-test-page', 'Η σελίδα δεν βρέθηκε.', 'Page not found.'],
  ]) {
    const missingPage = url === '/missing-language-test-page';
    if (missingPage)
      await page
        .context()
        .addCookies([{ name: 'tsn_language', value: 'el', url: new URL(page.url()).origin }]);
    await page.goto(url);
    if (!missingPage) await language(page).selectOption('el');
    await expect(page.getByRole('heading', { name: greek, exact: true })).toBeVisible();
    if (missingPage) {
      // A refresh of the 404 causes a full document navigation. Do not switch twice across it.
      await Promise.all([
        page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() }),
        language(page).selectOption('en'),
      ]);
    } else await language(page).selectOption('en');
    await expect(page.getByRole('heading', { name: english, exact: true })).toBeVisible();
    await noOverflow(page);
  }
});
