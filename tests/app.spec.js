import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const apiURL = 'https://ws.audioscrobbler.com/2.0/**';
const artists = [
  { name: 'Radiohead', playcount: '1200' },
  { name: 'Pulp', playcount: '800' },
];

async function respondWithArtists(route, result = artists) {
  await route.fulfill({ json: { topartists: { artist: result } } });
}

async function search(page, username = 'test-listener') {
  // Use roles until associated form labels are added in issue #10.
  await page.getByRole('textbox').fill(username);
  await page.getByRole('button', { name: 'Get Top Artists' }).click();
}

function artistRow(page, name) {
  return page.getByRole('listitem').filter({ hasText: name });
}

test.beforeEach(async ({ context, baseURL }) => {
  // No API calls or analytics may leave the test browser. Each test gets its own
  // browser context, including fresh localStorage; page routes supply API mocks.
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === new URL(baseURL).origin) {
      return route.continue();
    }
    return route.abort();
  });
});

test('searches with selected filters and updates seen counts', async ({ page }) => {
  await page.route(apiURL, route => respondWithArtists(route));
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  await page.getByRole('combobox').selectOption('12month');
  await page.getByRole('spinbutton').fill('2');
  const request = page.waitForRequest(apiURL);
  await search(page);
  const parameters = new URL((await request).url()).searchParams;
  expect(Object.fromEntries(parameters)).toEqual({
    method: 'user.gettopartists',
    user: 'test-listener',
    period: '12month',
    limit: '2',
    api_key: 'last-live-test-key',
    format: 'json',
  });

  const radiohead = artistRow(page, 'Radiohead').getByRole('checkbox');
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(radiohead).not.toBeChecked();
  await expect(page.getByText('You have seen 0.00%')).toBeVisible();
  await radiohead.check();
  await expect(page.getByText('You have seen 50.00%')).toBeVisible();
  await radiohead.uncheck();
  await expect(page.getByText('You have seen 0.00%')).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
});

test('restores marks after reloading the production app', async ({ page }) => {
  await page.route(apiURL, route => respondWithArtists(route));
  await page.goto('./');
  await search(page);
  await artistRow(page, 'Radiohead').getByRole('checkbox').check();
  await expect(page.getByText('You have seen 50.00%')).toBeVisible();

  await page.reload();
  await search(page);
  await expect(artistRow(page, 'Radiohead').getByRole('checkbox')).toBeChecked();
  await expect(artistRow(page, 'Pulp').getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByText('You have seen 50.00%')).toBeVisible();
});

test('downloads artist and results images as valid PNGs', async ({ page }) => {
  await page.route(apiURL, route => respondWithArtists(route));
  await page.goto('./');
  await search(page);
  await artistRow(page, 'Radiohead').getByRole('checkbox').check();
  await expect(page.getByText('You have seen 50.00%')).toBeVisible();

  for (const [button, filename] of [
    ['Share Table', 'last-live-artists-table.png'],
    ['Share Results', 'last-live-results.png'],
  ]) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: button }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(filename);
    expect(await download.failure()).toBeNull();
    const image = await readFile(await download.path());
    expect(image.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(image.readUInt32BE(16)).toBeGreaterThan(0);
    expect(image.readUInt32BE(20)).toBeGreaterThan(0);
  }
});

for (const failure of ['HTTP error', 'API error', 'network error']) {
  test(`shows a failure and allows retry after ${failure}`, async ({ page }) => {
    let attempts = 0;
    await page.route(apiURL, async route => {
      if (attempts++ > 0) return respondWithArtists(route);
      if (failure === 'network error') return route.abort('failed');
      return route.fulfill({
        status: failure === 'HTTP error' ? 403 : 200,
        json: { error: 10, message: 'Invalid API key' },
      });
    });
    await page.goto('./');
    await search(page);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/\S/);
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    await search(page);
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('clears previous results for an empty artist list and can search again', async ({ page }) => {
  let attempts = 0;
  await page.route(apiURL, route => respondWithArtists(route, attempts++ === 1 ? [] : artists));
  await page.goto('./');
  await search(page);
  await expect(page.getByRole('listitem')).toHaveCount(2);

  await search(page, 'empty-listener');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);

  await search(page, 'another-listener');
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
