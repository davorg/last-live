# Last Live

Last Live is a React application that allows users to explore their top artists
from LastFM and track which ones they have seen live. The app fetches data from
the LastFM API and provides an interactive interface to mark artists as "seen"
or "not seen." It also displays a pie chart summarizing the percentage of
artists seen live.

## Features

- Fetch top artists from LastFM based on username and time period.
- Mark artists as "seen live" or "not seen."
- View a dynamic pie chart showing the percentage of artists seen live.
- Data persistence using LocalStorage.

Searches require a nonempty Last.fm username and a whole-number artist count
from 1 to 1000. This is an app limit to keep lists and image exports bounded.
Leading/trailing username whitespace is removed; other characters are preserved
and URL-encoded so they cannot alter the request parameters. Invalid input is
reported beside the search controls without making an API request.

The app shows when a search is loading. Submitting another search cancels the
previous request, and only the latest submission can update the screen. Previous
results are cleared when starting a search, so a failed request cannot leave an
old chart looking current. Empty charts show a message with the searched
username; API errors preserve Last.fm's explanation, with readable fallbacks for
connection failures and unexpected responses. Correct the input or submit again
to retry.

Seen-artist marks are saved in this browser under `last-live:v1:seenArtists`.
On the first visit after upgrading, valid marks from the older `seenArtists`
key are copied to the new key. The original is retained as a recovery copy;
the new key takes precedence on later visits.

If saved data cannot be read or has an invalid format, the app leaves it
untouched and allows marking artists for the current visit only. A warning
also appears if changes cannot be saved (for example, because browser storage
is blocked or full). Marks are not synchronised between devices.

## Live Demo

Check out the live site here: [Last Live](https://davorg.dev/last-live/)

## Getting Started

### Prerequisites

- Node.js 24 LTS and its bundled npm. The required major version is declared in
  `.nvmrc` and used by both CI jobs. If you use nvm, run `nvm install` and
  `nvm use` from the repository before installing dependencies.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/davorg/last-live.git
   ```
2. Navigate to the project directory:
   ```bash
   cd last-live
   ```
3. Install dependencies:
   ```bash
   npm ci
   ```
4. Copy `.env.example` to `.env` and configure direct Last.fm requests or a
   proxy as described below.

### API Configuration

The defaults preserve direct Last.fm access. For direct requests, leave the URL
blank and set your [Last.fm API key](https://www.last.fm/api/account/create):

```dotenv
VITE_LASTFM_API_URL=
VITE_LASTFM_API_KEY=your-lastfm-api-key
```

For a separately hosted proxy that adds its own key on the server:

```dotenv
VITE_LASTFM_API_URL=https://proxy.example/lastfm
VITE_LASTFM_API_KEY=
```

| Setting | Behaviour |
| --- | --- |
| `VITE_LASTFM_API_URL` | Blank uses `https://ws.audioscrobbler.com/2.0/`. Otherwise, set an absolute HTTP(S) endpoint URL. |
| `VITE_LASTFM_API_KEY` | Required for the default endpoint and explicit URLs on `ws.audioscrobbler.com`. Embedded in direct builds; ignored and excluded from proxy builds. |

Whitespace around settings is trimmed. Invalid URLs, embedded credentials, URL
fragments and `api_key` URL parameters stop the development server or build with
a configuration error. Unrelated endpoint query parameters are preserved;
the app controls `method`, `user`, `period`, `limit` and `format`. A request
without a configured key omits `api_key` entirely.

Proxy requests use GET with those same parameters. The proxy must return the
Last.fm JSON response shape (`topartists.artist`, or `error` and `message` on
failure) and permit the app's browser origin through CORS when hosted on another
origin. Use HTTPS for a proxy called from the HTTPS live site. The proxy itself
is maintained separately; deployed integration checks are tracked in #17.

These settings are applied at build time, not read from the hosting server at
runtime. Rebuild and redeploy after changing them; restart the development
server after editing `.env`. Proxy builds exclude a leftover frontend key even
if it remains in `.env` or the build environment. This does not revoke a key
already published in an older direct build; replace it on the server when the
proxy migration is complete. Never put the Last.fm shared secret in this app.

### Running the App

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Building for Production

To create a production build:
```bash
npm run build
```

The build output will be in the `dist/` directory.

### Checking Changes

Use the same Node.js 24 LTS environment for building, linting and browser tests.

Install the test browser once after installing npm dependencies:
```bash
npx playwright install chromium
```
On Linux, use `npx playwright install --with-deps chromium` if browser system
dependencies are missing.

Run the checks:
```bash
npm run lint
npm test
```

`npm test` first runs the API-client and configuration tests with Node's built-in
test runner, then runs the Playwright browser checks. Use `npm run test:unit`
for the API/configuration tests alone; they use an injected fetch function and
local builds and require no network access. Build regressions check that direct
mode rejects a missing key and that a proxy artifact excludes a leftover key.

Playwright builds the direct production app into `.test-dist/` with a dummy API
key and a keyless proxy app into `.test-proxy-dist/`, starts local preview
servers, and runs Chromium tests. No Last.fm credentials
are needed: API responses are mocked, external browser requests (including
analytics) are blocked, and each test has isolated browser storage. The normal
`dist/` build is left untouched. Ports 4173, 4174 and 4175 must be available: the
storage regression tests also run against the development app with React
Strict Mode enabled, using a separate `.test-cache/` directory.

The initial tests cover searching with filters, marking/unmarking artists,
restoring marks after a production reload, HTTP/API/network failures and retry,
and empty results. Storage regressions cover legacy migration, reloads,
Strict Mode, invalid values, blocked storage, failed writes and recovery in both
production and development. Input tests cover validation, limits, whitespace
and special-character encoding. Request regressions cover cancellation, responses
arriving out of order (including clients that ignore cancellation), loading,
malformed responses, failures and recovery. Proxy build tests cover encoded
parameters, key omission, successful/empty results, API errors, throttling,
non-JSON failures and retry using mocked responses. They do not verify a live
proxy's CORS, caching or rate-limit policy; those integration checks remain #17.

Use `npm test -- --headed` to watch a run. On failure, inspect `test-results/`
for screenshots and traces, or run `npx playwright show-report` for the HTML
report.

### Code Structure

`App.jsx` connects the API client, request hook, persistence hook and UI sections:

- `src/api/lastfm.js` constructs requests and handles the Last.fm response.
  Its client factory accepts endpoint, API-key and fetch dependencies.
- `src/api/config.js` resolves and validates build configuration. Vite explicitly
  exposes only the effective URL and frontend key, excluding the key in proxy mode.
- `src/useTopArtists.js` owns request status, cancellation, errors and successful
  results, including a snapshot of the submitted query. It ignores completions
  from superseded requests even if cancellation does not stop them.
- `src/searchQuery.js` normalises and validates input for both the request hook
  and API client, with a shared artist-count limit.
- `src/useSeenArtists.js` owns saved marks and storage migration/failure handling.
- `src/components/` contains the search controls, artist list and results/chart.
- `src/downloadImage.js` shares PNG capture/download logic; each exporting
  component supplies its own section through a React ref.

Direct Last.fm and configured proxy requests share the same request construction
and response handling.

### Dependency Maintenance

Dependabot checks npm packages and GitHub Actions weekly. Compatible minor and
patch updates are grouped by runtime dependencies, development dependencies,
and Actions; major updates remain separate for review. Commit lockfile changes
and run the same lint, browser and production-build checks before merging.

Use `npm audit` to review dependency advisories. Vite loads the app's `.env`
files natively; a separate dotenv dependency is not required.

### Deploying to GitHub Pages

For direct requests, add a repository Actions secret named
`VITE_LASTFM_API_KEY` in **Settings → Secrets and variables → Actions** and leave
the `VITE_LASTFM_API_URL` Actions variable unset. The build stops if the key is
missing, including when the URL variable explicitly selects Last.fm.

For proxy requests, set the repository **Actions variable**
`VITE_LASTFM_API_URL` to the proxy endpoint. No frontend key secret is required;
an existing key secret is ignored and excluded from the proxy artifact. The
workflow passes the URL variable and key secret into Vite, which validates both
deployment modes using the same rules as local builds.

Pull requests run lint and the production browser tests without deployment
credentials. Pushes to `main` and manual runs on `main` run the same checks,
then build a separate Pages artifact using the deployment settings and deploy only after
the checks pass. Test builds are never uploaded as the Pages artifact.

After changing the Actions variable or secret, run the deployment workflow on
`main` (or push another checked change) to rebuild and deploy. Changing a setting
alone does not change the deployed bundle. A local `.env` file is ignored by Git
and is not available to GitHub Actions.

## Versioning and Releases

Last Live uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html),
starting at **1.0.0**. `package.json` is the source of truth: Vite embeds its
version in the app footer during the build. See [CHANGELOG.md](CHANGELOG.md)
for release notes.

The compatibility contract covers documented deployment configuration, the
Last.fm/proxy integration, and saved/imported/exported data formats:

- **PATCH** (`1.0.0` → `1.0.1`): compatible bug fixes.
- **MINOR** (`1.0.0` → `1.1.0`): compatible new functionality or deprecations.
- **MAJOR** (`1.0.0` → `2.0.0`): incompatible changes to that contract, such as
  removing a documented configuration option or requiring manual data conversion.

Automatic migrations that preserve existing data are compatible changes.
The storage schema version is independent of the app version; keep the current
storage key unless its data format actually changes.

Include the appropriate version bump and changelog entry in a PR that changes
shipped behaviour. Documentation, tests and internal refactors that preserve
behaviour do not require a release bump. To prepare a bug-fix release, run:

```bash
npm version patch --no-git-tag-version
```

Use `minor` or `major` instead for the other release types. This updates both
`package.json` and `package-lock.json` without creating a commit or tag. Add the
release notes under the new version in `CHANGELOG.md`, run lint, tests and the
production build, and commit the changes on the issue branch for review.

After the release commit is merged and its checks and deployment pass, create
and push an annotated Git tag matching that commit's package version. For
example, for the initial release (replace `RELEASE_COMMIT` with the merged
commit SHA):

```bash
git tag -a v1.0.0 RELEASE_COMMIT -m "Release 1.0.0"
git push origin v1.0.0
```

Use the new version in both the tag name and message for subsequent releases.
Released versions and tags are immutable; corrections get a new version. Tags
identify releases; Pages deployment continues to run from checked merges to
`main`. This repository is a hosted app and is not published to npm.

## License

This project is open-source and available under the [MIT License](LICENSE).
