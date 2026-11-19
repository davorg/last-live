import { test, expect } from '@playwright/test';

const proxyURL = 'https://last-live-proxy.example/lastfm?**';
const artists = [{ name: 'Radiohead', playcount: '1200' }, { name: 'Pulp', playcount: '800' }];

test.beforeEach(async ({ context, baseURL }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin
    ? route.continue() : route.abort());
});

async function search(page, username = 'test-listener') {
  await page.getByRole('textbox').fill(username);
  await page.getByRole('button', { name: 'Get Top Artists' }).click();
}

test('a keyless production build sends encoded search parameters to the configured proxy', async ({ page }) => {
  await page.route(proxyURL, route => route.fulfill({ json: { topartists: { artist: artists } } }));
  await page.goto('./');
  await page.getByRole('combobox').selectOption('12month');
  await page.getByRole('spinbutton').fill('2');
  const requested = page.waitForRequest(proxyURL);
  const username = '  Björk &limit=999+%?#=yes  ';
  await search(page, username);
  const request = await requested;
  expect(request.method()).toBe('GET');
  expect(Object.fromEntries(new URL(request.url()).searchParams)).toEqual({
    route: 'artists', method: 'user.gettopartists', user: username.trim(),
    period: '12month', limit: '2', format: 'json',
  });
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('shows an empty proxy result and can search again', async ({ page }) => {
  let attempts = 0;
  await page.route(proxyURL, route => route.fulfill({
    json: { topartists: { artist: attempts++ === 0 ? [] : artists } },
  }));
  await page.goto('./');
  await search(page);
  await expect(page.getByRole('status')).toContainText('No top artists found for test-listener');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await search(page);
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('status')).toHaveCount(0);
});

for (const [failure, message] of [
  ['API', 'Last.fm: User not found'],
  ['throttling', 'Last.fm: Rate limit exceeded'],
  ['non-JSON', 'Last.fm request failed (HTTP 503 Service Unavailable). Please try again.'],
  ['network', 'Could not connect to Last.fm. Check your connection and try again.'],
]) {
  test(`shows ${failure} proxy errors and allows retry`, async ({ page }) => {
    let attempts = 0;
    await page.route(proxyURL, route => {
      if (attempts++ > 0) return route.fulfill({ json: { topartists: { artist: artists } } });
      if (failure === 'network') return route.abort('failed');
      if (failure === 'non-JSON') return route.fulfill({ status: 503, body: '<html>Unavailable</html>' });
      return route.fulfill({
        status: failure === 'throttling' ? 429 : 200,
        json: failure === 'throttling' ? { error: 29, message: 'Rate limit exceeded' }
          : { error: 6, message: 'User not found' },
      });
    });
    await page.goto('./');
    await search(page);
    await expect(page.getByRole('alert')).toHaveText(message);
    await expect(page.getByRole('listitem')).toHaveCount(0);
    await search(page);
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}
