import { test,expect } from '@playwright/test';
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'tsn_language', value: 'en', url: baseURL! }]);
});
import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
async function emailLink(email:string,purpose:string){
 let link='';
 await expect.poll(async()=>{
  const messages=await Promise.all((await readdir(process.env.API_TEST_MAIL_DIR!)).map(async file=>JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR!,file),'utf8'))));
  link=messages.filter(item=>item.email===email&&item.purpose===purpose).sort((a,b)=>a.createdUtc.localeCompare(b.createdUtc)).at(-1)?.link??'';
  return Boolean(link);
 }).toBe(true);
 return new URL(link).hash;
}
test('catalog renders, switches product imagery, keeps basket across reload and removes lines',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'The pieces',exact:true})).toBeVisible();
  const hoodie=page.getByRole('article',{name:'Ghost Hoodie'});
  await hoodie.getByRole('button',{name:'Back',exact:true}).click();
  await expect(hoodie.getByRole('img',{name:'Ghost Hoodie, back'})).toHaveAttribute('src','/images/hood_back.jpg');
  await hoodie.getByRole('button',{name:'Ghost Hoodie size M',exact:true}).click();
  await hoodie.getByRole('button',{name:'Add to cart',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cart',exact:true})).toContainText('1');
  await expect(page.getByRole('region',{name:'Shopping cart'})).toContainText('Size M');
  await page.reload();
  await expect(page.getByRole('button',{name:'Cart',exact:true})).toContainText('1');
  await page.getByRole('button',{name:'Cart',exact:true}).click();
  await page.getByRole('button',{name:'Remove hood-M',exact:true}).click();
  await expect(page.getByRole('region',{name:'Shopping cart'})).toContainText('Your cart is empty');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('newsletter persists consent and admin endpoint requires authentication',async({page,request})=>{
  await page.goto('/');
  await page.getByLabel('Your email',{exact:true}).fill(`e2e-${Date.now()}@example.com`);
  await page.getByRole('checkbox',{name:/I agree to receive drop updates/}).check();
  await page.getByRole('button',{name:'Join',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Check your email to confirm your subscription.');
  const response=await request.get('/api/admin/orders');expect(response.status()).toBe(401);
});
test('cash on delivery checkout supports guest access and account claim without an online payment',async({page},testInfo)=>{
  test.setTimeout(90000);
  const buyer='guest-browser-'+testInfo.project.name+'-'+Date.now()+'@phase1.example';
  await page.goto('/');
  const crew=page.getByRole('article',{name:'Tag Crewneck'});
  await crew.getByRole('button',{name:'Tag Crewneck size S',exact:true}).click();
  await crew.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByRole('link',{name:'Checkout',exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('tsn_checkout_attempt_v1')??'{}').requestKey??'')).not.toBe('');
  const attempt=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tsn_checkout_attempt_v1')!).requestKey);
  await page.reload();await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('tsn_checkout_attempt_v1')!).requestKey)).toBe(attempt);
  await page.getByLabel('Email',{exact:true}).fill(buyer);
  await page.getByLabel('Full name').fill('Test Buyer');
  await page.getByLabel('Street address').fill('Test Street 1');
  await page.getByLabel('City',{exact:true}).fill('Athens');
  await page.getByLabel('Postal code').fill('10563');
  await expect(page.getByLabel('Payment method')).toHaveValue('CashOnDelivery');
  await expect(page.getByLabel('Payment method').locator('option')).toHaveCount(2);
  await page.getByRole('checkbox',{name:/I accept the terms/}).check();
  await page.getByRole('button',{name:'Place order',exact:true}).click();
  await expect(page).toHaveURL(/checkout\/success/);
  await expect(page.getByRole('heading',{name:'You got it.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cart',exact:true})).toContainText('0');
  if(process.env.API_TEST_AUTH_ENABLED==='true'){
   const number=(await page.locator('.receipt .mono').innerText()).match(/TSN-[A-F0-9]+/)![0];
   await page.goto('/order-access');await page.getByLabel('Order number',{exact:true}).fill(number);await page.getByLabel('Order email',{exact:true}).fill(buyer);
   await page.getByRole('button',{name:'Send order link',exact:true}).click();
   await expect(page.getByRole('status')).toContainText('If the details match');
   await page.goto('/order-access'+await emailLink(buyer,'order-access'));await expect(page).toHaveURL(/\/order-access$/);
   await page.getByRole('button',{name:'Open order',exact:true}).click();await expect(page.getByRole('heading',{name:'Order '+number,exact:true})).toBeVisible();
   await expect(page.getByText('Request a return or withdrawal',{exact:true})).toHaveCount(0);
   await page.goto('/account/register');await page.getByLabel('Full name',{exact:true}).fill('Test Buyer');await page.getByLabel('Email',{exact:true}).fill(buyer);await page.getByLabel('Password',{exact:true}).fill('Ab3?defg');
   await page.getByRole('button',{name:'Create an account',exact:true}).click();await expect(page.getByRole('status')).toContainText('Confirm your email');
   await page.goto('/account/verify-email'+await emailLink(buyer,'verify-email'));await page.getByRole('button',{name:'Confirm your email',exact:true}).click();await expect(page).toHaveURL(/\/account$/);
   await page.goto('/order-access');await page.getByLabel('Order number',{exact:true}).fill(number);await page.getByLabel('Order email',{exact:true}).fill(buyer);await page.getByLabel('What would you like to do?').selectOption('claim');
   await page.getByRole('button',{name:'Send order link',exact:true}).click();await expect(page.getByRole('status')).toContainText('If the details match');
   await page.goto('/order-access'+await emailLink(buyer,'order-claim'));await page.getByRole('button',{name:'Link order to my account',exact:true}).click();
   await expect(page).toHaveURL(/\/account\/orders\/[a-f0-9]+$/);await expect(page.getByRole('heading',{name:'Order '+number,exact:true})).toBeVisible();
  }
});
test('bank transfer checkout shows the snapshotted Revolut instructions and remains unpaid',async({page},testInfo)=>{
  await page.goto('/');
  const crew=page.getByRole('article',{name:'Tag Crewneck'});
  await crew.getByRole('button',{name:'Tag Crewneck size M',exact:true}).click();
  await crew.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByRole('link',{name:'Checkout',exact:true}).click();
  await page.getByLabel('Email',{exact:true}).fill('bank-browser-'+testInfo.project.name+'@phase1.example');
  await page.getByLabel('Full name').fill('Bank fixture');
  await page.getByLabel('Street address').fill('Fixture street');
  await page.getByLabel('City',{exact:true}).fill('Athens');
  await page.getByLabel('Postal code').fill('10563');
  await page.getByLabel('Payment method').selectOption('BankTransfer');
  await page.getByRole('checkbox',{name:/I accept the terms/}).check();
  await page.getByRole('button',{name:'Place order',exact:true}).click();
  await expect(page).toHaveURL(/checkout\/success/);
  await expect(page.getByText(/IBAN: GB82WEST12345698765432/)).toBeVisible();
  await expect(page.getByText(/Payment reference: TSN-/)).toBeVisible();
  await expect(page.getByText(/Payment: pending/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Cart',exact:true})).toContainText('0');
  await page.reload();
  await expect(page.getByText(/IBAN: GB82WEST12345698765432/)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('admin can edit a product price and restore it',async({page},testInfo)=>{
  test.setTimeout(180000);
  test.skip(!process.env.E2E_ADMIN_PASSWORD,'Set E2E_ADMIN_PASSWORD for management tests.');
  await page.goto('/admin');
  await page.getByLabel('Email',{exact:true}).fill(process.env.E2E_ADMIN_EMAIL??'admin@thesamenot.local');
  await page.getByLabel('Password',{exact:true}).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  if(process.env.API_TEST_AUTH_ENABLED==='true') {
    const state=JSON.parse(await readFile(process.env.API_TEST_AUTH_STATE!,'utf8'));
    await page.getByLabel('Verification code',{exact:true}).fill(state.adminCodes[testInfo.project.name.includes('mobile')?3:2]);
    await page.getByRole('button',{name:'Verify',exact:true}).click();
  }
  await expect(page.getByRole('heading',{name:'Drop control'})).toBeVisible();
  const product=page.locator('section').filter({has:page.getByRole('img',{name:'Ghost Hoodie',exact:true})});
  await product.getByLabel('Price (€)').fill('42.50');
  await product.getByRole('button',{name:'Save product'}).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  if(process.env.API_TEST_AUTH_ENABLED==='true'){
   const name='Browser piece '+testInfo.project.name,sku='BROWSER-'+testInfo.project.name.toUpperCase(),slug='browser-piece-'+testInfo.project.name;
   await page.getByRole('link',{name:'Product catalog',exact:true}).click();await page.getByRole('button',{name:'Add product',exact:true}).click();
   await page.getByLabel('Name',{exact:true}).fill(name);await page.getByLabel('Slug',{exact:true}).fill(slug);
   await page.getByLabel('Description',{exact:true}).fill('Browser fixture </script><script>throw new Error("XSS")</script>');
   await page.getByLabel('Material',{exact:true}).fill('Fixture fabric');await page.getByLabel('Care',{exact:true}).fill('Fixture care');await page.getByLabel('Size guide',{exact:true}).fill('Fixture size guide');
   await page.getByLabel('Inventory mode').selectOption('replenishable');await page.getByRole('button',{name:'Save product',exact:true}).click();
   await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
   await page.getByLabel('New SKU',{exact:true}).fill(sku);await page.getByLabel('New size',{exact:true}).fill('M');await page.getByLabel('New color',{exact:true}).fill('Black');
   await page.getByRole('button',{name:'Add SKU',exact:true}).click();await expect(page.getByLabel('SKU',{exact:true})).toHaveValue(sku);
   await page.getByLabel('Available '+sku,{exact:true}).fill('5');await page.getByLabel('Adjustment reason',{exact:true}).fill('Browser fixture stock');await page.getByRole('button',{name:'Adjust stock',exact:true}).click();
   await expect(page.getByLabel('Available '+sku,{exact:true})).toHaveValue('5');
   await page.getByLabel('Image file',{exact:true}).setInputFiles(path.resolve('public/images/hood_front.jpg'));await page.getByLabel('Image description',{exact:true}).fill(name+' front');
   await page.getByRole('button',{name:'Upload image',exact:true}).click();await expect(page.getByRole('img',{name:name+' front',exact:true})).toBeVisible({timeout:20000});
   await page.getByRole('combobox',{name:'Publication',exact:true}).selectOption('published');await page.getByRole('button',{name:'Save product',exact:true}).click();await expect(page.getByRole('button',{name:'Save product',exact:true})).toBeEnabled();await expect(page.getByLabel('Publication')).toHaveValue('published');
   await page.goto('/products/'+slug);await expect(page.getByRole('heading',{name,level:1,exact:true})).toBeVisible();
   const schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent()??'{}');expect(schema.description).toContain('</script>');
   await page.getByRole('button',{name:name+' size M',exact:true}).click();await page.getByRole('button',{name:'Add to cart',exact:true}).click();await expect(page.getByRole('button',{name:'Cart',exact:true})).toContainText('1');
   await page.reload();await expect(page.getByRole('button',{name:'Cart',exact:true})).toContainText('1');
   await page.goto('/admin/products');await page.getByRole('button',{name:'Edit '+name,exact:true}).click();await page.getByRole('button',{name:'Archive product',exact:true}).click();await expect(page.getByLabel('Publication')).toHaveValue('archived');
   expect((await page.request.get('/api/products/'+slug)).status()).toBe(404);
   await page.getByRole('navigation',{name:'Administration',exact:true}).getByRole('link',{name:'Shipping',exact:true}).click();
   await page.getByLabel('Shipping cost (€)',{exact:true}).fill('5');await page.getByRole('button',{name:'Save shipping',exact:true}).click();await expect(page.getByText('Shipping saved. Existing orders keep their original amounts.',{exact:true})).toBeVisible();
   await page.getByLabel('Shipping cost (€)',{exact:true}).fill('4');await page.getByRole('button',{name:'Save shipping',exact:true}).click();await expect(page.getByRole('button',{name:'Save shipping',exact:true})).toBeEnabled();await expect(page.getByLabel('Shipping cost (€)',{exact:true})).toHaveValue('4');
   await page.goto('/admin/jobs');await expect(page.getByRole('heading',{name:'Background jobs',exact:true})).toBeVisible();await page.getByRole('button',{name:'Refresh jobs',exact:true}).click();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await page.goto('/admin');
  await page.reload();
  await expect(product.getByLabel('Price (€)')).toHaveValue('42.5');
  await product.getByLabel('Price (€)').fill('42');
  await product.getByRole('button',{name:'Save product'}).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('heading',{name:'Store admin'})).toBeVisible();
});
test('shop pages expose metadata, bounded sitemap and nonce CSP without indexing private pages',async({page,request})=>{
 test.setTimeout(90000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const response=await page.goto('/products/ghost-hoodie');expect(response?.status()).toBe(200);
 expect(response?.headers()['content-security-policy']).toContain("'strict-dynamic'");expect(response?.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
 await expect(page).toHaveTitle('Ghost Hoodie — thesamenot');await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/products\/ghost-hoodie$/);
 const schema=page.locator('script[type="application/ld+json"]');expect(JSON.parse(await schema.textContent()??'{}').offers.priceCurrency).toBe('EUR');
 const nonce=await schema.evaluate((element:HTMLScriptElement)=>element.nonce??'');expect(nonce.length).toBeGreaterThan(10);expect(response?.headers()['content-security-policy']).toContain("'nonce-"+nonce+"'");
 await page.goto('/shop?query=Ghost&size=M&sort=price-asc');await expect(page.getByRole('article',{name:'Ghost Hoodie',exact:true})).toBeVisible();await expect(page.getByRole('article',{name:'Tag Crewneck',exact:true})).toHaveCount(0);
 const index=await request.get('/sitemap-index.xml');expect(index.status()).toBe(200);expect(await index.text()).toContain('/product-sitemaps/1');
 const sitemap=await request.get('/product-sitemaps/1');expect(await sitemap.text()).toContain('/products/ghost-hoodie');expect(await sitemap.text()).not.toContain('/admin');
 const account=await request.get('/account');expect(account.headers()['x-robots-tag']).toBe('noindex, nofollow');expect(account.headers()['cache-control']).toContain('no-store');
 expect(errors).toEqual([]);
 for(const route of ['/shop','/account/register']){
  await page.goto(route);
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(accessibility.violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>node.target)}))).toEqual([]);
 }
 await page.goto('/shop');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to content',exact:true})).toBeFocused();await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>document.activeElement?.id==='main-content')).toBe(true);
});
