import { test,expect } from '@playwright/test';
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'tsn_language', value: 'en', url: baseURL! }]);
});
import { readdir,readFile } from 'node:fs/promises';
import path from 'node:path';

test('customer can register, confirm email, sign in and sign out',async({page},testInfo)=>{
  test.setTimeout(90000);
  test.skip(process.env.API_TEST_AUTH_ENABLED!=='true','Requires the isolated phase1 runner.');
  const email='browser-'+testInfo.project.name+'-'+Date.now()+'@phase1.example';
  const password='Ab3?defg';
  await page.goto('/account/register');
  await page.getByLabel('Full name').fill('Browser Customer');
  await page.getByLabel('Email',{exact:true}).fill(email);
  const passwordInput=page.getByLabel('Password',{exact:true});
  await expect(passwordInput).toHaveAttribute('minlength','8');
  for(const invalid of ['Ab3!def','ab3!defg','AB3!DEFG','Abc!defg','Ab3zdefg','Ab3defg ','Αβ3😀δεζ']) {
    await passwordInput.fill(invalid);
    expect(await passwordInput.evaluate((element:HTMLInputElement)=>element.checkValidity())).toBe(false);
  }
  for(const valid of ['Ab3!defg','Αβ3?δεζη','Αβ3😀δεζη']) {
    await passwordInput.fill(valid);
    expect(await passwordInput.evaluate((element:HTMLInputElement)=>element.checkValidity())).toBe(true);
  }
  await passwordInput.fill(password);
  await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Confirm your email before signing in.');
  const files=await readdir(process.env.API_TEST_MAIL_DIR!);
  const messages=await Promise.all(files.map(async file=>JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR!,file),'utf8'))));
  const message=messages.find(item=>item.email===email&&item.purpose==='verify-email');
  const fragment=new URL(message.link).hash;
  await page.goto('/account/verify-email'+fragment);
  await expect(page).toHaveURL(/\/account\/verify-email$/);
  await page.getByRole('button',{name:'Confirm your email',exact:true}).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText('Browser Customer · '+email)).toBeVisible();
  const response=await page.request.get('/api/admin/orders');expect(response.status()).toBe(401);
  const cookies=await page.context().cookies();expect(cookies.find(cookie=>cookie.name==='tsn_customer')?.httpOnly).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByLabel('Full name',{exact:true}).fill('Updated Customer');
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await expect(page.getByText('Updated Customer · '+email)).toBeVisible();
  await page.getByRole('link',{name:'Addresses',exact:true}).click();
  await page.getByLabel('Address label').fill('Home');
  await page.getByLabel('Full name',{exact:true}).fill('Updated Customer');
  await page.getByLabel('Street address').fill('Saved Street 12');
  await page.getByLabel('City',{exact:true}).fill('Athens');
  await page.getByLabel('Postal code').fill('10563');
  await page.getByLabel('Telephone').fill('+302101234567');
  await page.getByRole('button',{name:'Save address',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Home · Default',exact:true})).toBeVisible();
  await page.goto('/');
  const crew=page.getByRole('article',{name:'Tag Crewneck'});
  await crew.getByRole('button',{name:'Tag Crewneck size S',exact:true}).click();
  await crew.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByRole('link',{name:'Checkout',exact:true}).click();
  await expect(page.getByLabel('Street address')).toHaveValue('Saved Street 12');
  await expect(page.getByLabel('Telephone')).toHaveValue('+302101234567');
  await expect(page.getByLabel('Email',{exact:true})).toHaveValue(email);
  await expect(page.getByLabel('Email',{exact:true})).toHaveAttribute('readonly','');
  await page.getByRole('checkbox',{name:/I accept the terms/}).check();
  await page.getByRole('button',{name:'Place order',exact:true}).click();
  await expect(page.getByRole('heading',{name:'You got it.'})).toBeVisible();
  await page.goto('/account/orders');
  await page.getByRole('link',{name:/Order TSN-/}).first().click();
  await expect(page.getByText('Saved Street 12',{exact:false})).toBeVisible();
  await page.getByRole('link',{name:'Addresses',exact:true}).click();
  await page.getByRole('button',{name:'Remove Home',exact:true}).click();
  await expect(page.getByText('No saved addresses yet.')).toBeVisible();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(page.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();
});

test('confirmation in another browser redirects to sign-in with a consistent message',async({page,browser},testInfo)=>{
  test.skip(process.env.API_TEST_AUTH_ENABLED!=='true','Requires the isolated phase1 runner.');
  const email='other-browser-'+testInfo.project.name+'-'+Date.now()+'@phase1.example';
  await page.goto('/account/register');
  await page.getByLabel('Full name').fill('Other Browser Customer');
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('Ab3?defg');
  await page.getByRole('button',{name:'Create an account',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Confirm your email before signing in.');
  const files=await readdir(process.env.API_TEST_MAIL_DIR!);
  const messages=await Promise.all(files.map(async file=>JSON.parse(await readFile(path.join(process.env.API_TEST_MAIL_DIR!,file),'utf8'))));
  const message=messages.find(item=>item.email===email&&item.purpose==='verify-email');
  const context=await browser.newContext({baseURL:testInfo.project.use.baseURL});
  await context.addCookies([{name:'tsn_language',value:'en',url:testInfo.project.use.baseURL!}]);
  try {
    const otherPage=await context.newPage();
    await otherPage.goto('/account/verify-email'+new URL(message.link).hash);
    await otherPage.getByRole('button',{name:'Confirm your email',exact:true}).click();
    await expect(otherPage).toHaveURL(/\/account\/login\?verified=1$/);
    await expect(otherPage.getByRole('status')).toContainText('Your email is confirmed. Sign in to continue.');
    await expect(otherPage.getByText('Open the link from your email to continue.',{exact:false})).toHaveCount(0);
    expect((await otherPage.request.get('/api/auth/session')).status()).toBe(401);
    await otherPage.getByLabel('Email',{exact:true}).fill(email);
    await otherPage.getByLabel('Password',{exact:true}).fill('Ab3?defg');
    await otherPage.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(otherPage).toHaveURL(/\/account$/);
    await expect(otherPage.getByText('Other Browser Customer · '+email)).toBeVisible();
  } finally { await context.close(); }
});
