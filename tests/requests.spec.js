import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context, baseURL, page }) => {
  await context.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin
    ? route.continue() : route.abort());
  await page.addInitScript(() => {
    // Controllable responses let tests choose the completion order. Some tests
    // deliberately ignore aborts to exercise the stale-result guard as well.
    const originalFetch = window.fetch.bind(window);
    window.artistRequests = [];
    window.ignoreArtistCancellation = false;
    window.fetch = (url, options = {}) => {
      if (new URL(url, location.href).hostname !== 'ws.audioscrobbler.com') return originalFetch(url, options);
      return new Promise((resolve, reject) => {
        window.artistRequests.push({
          signal: options.signal,
          respond: data => resolve(Response.json(data)),
          fail: () => reject(new TypeError('Failed to fetch')),
        });
        if (!window.ignoreArtistCancellation) {
          options.signal?.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        }
      });
    };
  });
  await page.goto('./');
});

async function search(page, username) {
  await page.getByRole('textbox').fill(username);
  await page.getByRole('button', { name: 'Get Top Artists' }).click();
}

async function complete(page, index, outcome = 'success') {
  await page.evaluate(async ({ index, outcome }) => {
    const request = window.artistRequests[index];
    if (outcome === 'network error') request.fail();
    else request.respond(outcome === 'API error' ? { error: 6, message: 'User not found' }
      : { topartists: { artist: outcome === 'empty' ? [] : [{ name: `Artist ${index}`, playcount: '10' }] } });
    // Let response parsing, the hook continuation and React's render finish
    // before checking that an obsolete completion made no visible change.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { index, outcome });
}

test('shows loading, aborts a replaced search, and displays the latest result', async ({ page }) => {
  await search(page, 'first');
  await expect(page.getByRole('status')).toContainText('Loading artists');
  await expect.poll(() => page.evaluate(() => window.artistRequests.length)).toBe(1);
  await search(page, 'second');
  await expect.poll(() => page.evaluate(() => window.artistRequests[0].signal?.aborted)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.artistRequests.length)).toBe(2);
  await expect(page.getByRole('status')).toContainText('Loading artists');
  await expect(page.getByRole('alert')).toHaveCount(0);

  await complete(page, 1);
  await expect(page.getByRole('listitem')).toHaveText(['Artist 1 (10 scrobbles)']);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const outcome of ['success', 'empty', 'API error', 'network error']) {
  test(`ignores an earlier ${outcome} after the latest result`, async ({ page }) => {
    await page.evaluate(() => { window.ignoreArtistCancellation = true; });
    await search(page, 'slow-first');
    await search(page, 'fast-second');
    await complete(page, 1);
    await expect(page.getByRole('listitem')).toContainText(['Artist 1']);

    await complete(page, 0, outcome);
    await expect(page.getByRole('listitem')).toContainText(['Artist 1']);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
  });
}

for (const outcome of ['success', 'API error']) {
  test(`keeps loading when an earlier ${outcome} finishes`, async ({ page }) => {
    await page.evaluate(() => { window.ignoreArtistCancellation = true; });
    await search(page, 'first');
    await search(page, 'still-loading');
    await complete(page, 0, outcome);
    await expect(page.getByRole('status')).toContainText('Loading artists');
    await expect(page.getByRole('listitem')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    await complete(page, 1);
    await expect(page.getByRole('listitem')).toContainText(['Artist 1']);
    await expect(page.getByRole('status')).toHaveCount(0);
  });
}

test('does not replace a newer failure with an earlier success', async ({ page }) => {
  await page.evaluate(() => { window.ignoreArtistCancellation = true; });
  await search(page, 'slow-first');
  await search(page, 'missing-listener');
  await complete(page, 1, 'API error');
  await expect(page.getByRole('alert')).toHaveText('Last.fm: User not found');
  await complete(page, 0);
  await expect(page.getByRole('alert')).toHaveText('Last.fm: User not found');
  await expect(page.getByRole('listitem')).toHaveCount(0);
});

test('an invalid submission supersedes a pending request and permits recovery', async ({ page }) => {
  await page.evaluate(() => { window.ignoreArtistCancellation = true; });
  await search(page, 'first');
  await search(page, '   ');
  await expect(page.getByRole('alert')).toHaveText('Enter your Last.fm username.');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(() => window.artistRequests.length)).toBe(1);
  expect(await page.evaluate(() => window.artistRequests[0].signal.aborted)).toBe(true);
  await complete(page, 0);
  await expect(page.getByRole('alert')).toHaveText('Enter your Last.fm username.');
  await expect(page.getByRole('listitem')).toHaveCount(0);

  await search(page, 'valid-listener');
  await complete(page, 1);
  await expect(page.getByRole('listitem')).toContainText(['Artist 1']);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('clears previous results while the next search is loading', async ({ page }) => {
  await search(page, 'first');
  await complete(page, 0);
  await expect(page.getByRole('listitem')).toContainText(['Artist 0']);
  await search(page, 'second');
  await expect(page.getByRole('status')).toContainText('Loading artists');
  await expect(page.getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  await complete(page, 1, 'empty');
  await expect(page.getByRole('status')).toContainText('No top artists found for second');
});
