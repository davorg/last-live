import { test, expect } from '@playwright/test';

const storageKey = 'last-live:v1:seenArtists';
const legacyKey = 'seenArtists';

async function seedStorage(page, values) {
  await page.addInitScript(entries => {
    // Seed the first visit only, so reload checks exercise the app's saved data.
    if (sessionStorage.getItem('storage-fixture-seeded')) return;
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    sessionStorage.setItem('storage-fixture-seeded', 'true');
  }, values);
}

async function search(page) {
  await page.getByRole('textbox').fill('test-listener');
  await page.getByRole('button', { name: 'Get Top Artists' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
}

function mark(page, name) {
  return page.getByRole('listitem').filter({ hasText: name }).getByRole('checkbox');
}

async function savedMarks(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
}

test.beforeEach(async ({ context, page, baseURL }) => {
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === new URL(baseURL).origin) {
      return route.continue();
    }
    return route.abort();
  });
  await page.route('https://ws.audioscrobbler.com/2.0/**', route => route.fulfill({
    json: { topartists: { artist: [
      { name: 'Radiohead', playcount: '1200' },
      { name: 'Pulp', playcount: '800' },
    ] } },
  }));
});

test('migrates legacy marks, preserves the backup and restores later changes', async ({ page }) => {
  const original = { Radiohead: true, Pulp: false, Blur: true };
  await seedStorage(page, { [legacyKey]: JSON.stringify(original) });
  await page.goto('./');
  await search(page);
  await expect(mark(page, 'Radiohead')).toBeChecked();
  await expect(mark(page, 'Pulp')).not.toBeChecked();
  await expect.poll(() => savedMarks(page)).toEqual(original);
  await expect(page.getByRole('status')).toHaveCount(0);

  await mark(page, 'Radiohead').uncheck();
  await mark(page, 'Pulp').check();
  await expect.poll(() => savedMarks(page)).toEqual({ Radiohead: false, Pulp: true, Blur: true });
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe(JSON.stringify(original));

  await page.reload();
  await search(page);
  await expect(mark(page, 'Radiohead')).not.toBeChecked();
  await expect(mark(page, 'Pulp')).toBeChecked();
});

test('uses current marks instead of a legacy backup', async ({ page }) => {
  await seedStorage(page, {
    [storageKey]: JSON.stringify({ Radiohead: false, Pulp: true }),
    [legacyKey]: JSON.stringify({ Radiohead: true, Pulp: false }),
  });
  await page.goto('./');
  await search(page);
  await expect(mark(page, 'Radiohead')).not.toBeChecked();
  await expect(mark(page, 'Pulp')).toBeChecked();
  await expect(page.getByRole('status')).toHaveCount(0);
});

for (const key of [legacyKey, storageKey]) {
  for (const [description, value] of [
    ['malformed JSON', '{broken'],
    ['null', 'null'],
    ['an array', '[]'],
    ['non-boolean marks', '{"Radiohead":"yes"}'],
  ]) {
    test(`handles ${description} in ${key} without overwriting it`, async ({ page }) => {
      await seedStorage(page, { [key]: value });
      await page.goto('./');
      await search(page);
      await expect(page.getByRole('status')).toContainText('could not be loaded');
      await expect(page.getByRole('status')).toContainText('only last for this visit');
      await expect(mark(page, 'Radiohead')).not.toBeChecked();
      await mark(page, 'Radiohead').check();
      await expect(page.getByText('You have seen 50.00%')).toBeVisible();
      expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(value);
      if (key === legacyKey) {
        expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
      }
    });
  }
}

test('continues in memory when storage cannot be accessed', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage blocked', 'SecurityError'); },
    });
  });
  await page.goto('./');
  await search(page);
  await expect(page.getByRole('status')).toContainText('could not be loaded');
  await mark(page, 'Radiohead').check();
  await expect(page.getByText('You have seen 50.00%')).toBeVisible();
  await mark(page, 'Radiohead').uncheck();
  await expect(page.getByText('You have seen 0.00%')).toBeVisible();
});

test('keeps legacy data when migration cannot be saved', async ({ page }) => {
  await page.addInitScript(({ legacyKey, storageKey }) => {
    localStorage.setItem(legacyKey, '{"Radiohead":true}');
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === storageKey) throw new DOMException('Storage full', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
  }, { legacyKey, storageKey });
  await page.goto('./');
  await search(page);
  await expect(mark(page, 'Radiohead')).toBeChecked();
  await expect(page.getByRole('status')).toContainText('could not be saved');
  expect(await page.evaluate(key => localStorage.getItem(key), legacyKey)).toBe('{"Radiohead":true}');
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
});

test('warns about failed writes and retries saving on the next change', async ({ page }) => {
  await page.addInitScript(storageKey => {
    const originalSetItem = Storage.prototype.setItem;
    window.failSeenArtistWrites = true;
    Storage.prototype.setItem = function (key, value) {
      if (key === storageKey && window.failSeenArtistWrites) {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
  }, storageKey);
  await page.goto('./');
  await search(page);
  await mark(page, 'Radiohead').check();
  await expect(page.getByRole('status')).toContainText('could not be saved');
  await expect(page.getByText('You have seen 50.00%')).toBeVisible();

  await page.evaluate(() => { window.failSeenArtistWrites = false; });
  await mark(page, 'Pulp').check();
  await expect.poll(() => savedMarks(page)).toEqual({ Radiohead: true, Pulp: true });
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('supports artist names that match object property names', async ({ page }) => {
  await page.route('https://ws.audioscrobbler.com/2.0/**', route => route.fulfill({
    json: { topartists: { artist: [
      { name: 'constructor', playcount: '10' },
      { name: '__proto__', playcount: '5' },
    ] } },
  }));
  await page.goto('./');
  await search(page);
  await expect(mark(page, 'constructor')).not.toBeChecked();
  await expect(mark(page, '__proto__')).not.toBeChecked();
  await mark(page, 'constructor').check();
  await mark(page, '__proto__').check();
  await expect(page.getByText('You have seen 100.00%')).toBeVisible();
  await page.reload();
  await search(page);
  await expect(mark(page, 'constructor')).toBeChecked();
  await expect(mark(page, '__proto__')).toBeChecked();
});
