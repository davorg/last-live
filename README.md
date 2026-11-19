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
4. Copy `.env.example` to `.env` and set `VITE_LASTFM_API_KEY` to your
   [Last.fm API key](https://www.last.fm/api/account/create).

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

`npm test` first runs the API-client tests with Node's built-in test runner,
then runs the Playwright browser checks. Use `npm run test:unit` for the API
tests alone; they use an injected fetch function and require no network access.

Playwright builds the production app into `.test-dist/` with a dummy API key,
starts a local preview server, and runs Chromium tests. No Last.fm credentials
are needed: API responses are mocked, external browser requests (including
analytics) are blocked, and each test has isolated browser storage. The normal
`dist/` build is left untouched. Ports 4173 and 4174 must be available: the
storage regression tests also run against the development app with React
Strict Mode enabled, using a separate `.test-cache/` directory.

The initial tests cover searching with filters, marking/unmarking artists,
restoring marks after a production reload, HTTP/API/network failures and retry,
and empty results. Storage regressions cover legacy migration, reloads,
Strict Mode, invalid values, blocked storage, failed writes and recovery in both
production and development. Input tests cover validation, limits, whitespace
and special-character encoding. Add regression cases for request ordering (#8)
and proxy configuration (#5) alongside those fixes.

Use `npm test -- --headed` to watch a run. On failure, inspect `test-results/`
for screenshots and traces, or run `npx playwright show-report` for the HTML
report.

### Code Structure

`App.jsx` connects the API client, request hook, persistence hook and UI sections:

- `src/api/lastfm.js` constructs requests and handles the Last.fm response.
  Its client factory accepts endpoint, API-key and fetch dependencies.
- `src/useTopArtists.js` owns request status, errors and successful results,
  including a snapshot of the submitted query.
- `src/searchQuery.js` normalises and validates input for both the request hook
  and API client, with a shared artist-count limit.
- `src/useSeenArtists.js` owns saved marks and storage migration/failure handling.
- `src/components/` contains the search controls, artist list and results/chart.
- `src/downloadImage.js` shares PNG capture/download logic; each exporting
  component supplies its own section through a React ref.

The UI continues using the direct Last.fm endpoint. User-configurable proxy
deployment (#5) and request ordering/error improvements (#8) are follow-up
changes at these boundaries.

### Dependency Maintenance

Dependabot checks npm packages and GitHub Actions weekly. Compatible minor and
patch updates are grouped by runtime dependencies, development dependencies,
and Actions; major updates remain separate for review. Commit lockfile changes
and run the same lint, browser and production-build checks before merging.

Use `npm audit` to review dependency advisories. Vite loads the app's `.env`
files natively; a separate dotenv dependency is not required.

### Deploying to GitHub Pages

Add a repository Actions secret named `VITE_LASTFM_API_KEY` in GitHub's
**Settings → Secrets and variables → Actions**. The deployment workflow passes
this secret to the build and stops if it is missing.

Pull requests run lint and the production browser tests without deployment
credentials. Pushes to `main` and manual runs on `main` run the same checks,
then build a separate Pages artifact using the real key and deploy only after
the checks pass. Test builds are never uploaded as the Pages artifact.

Vite embeds the key in the browser bundle at build time, so adding or changing
the secret requires a new deployment. A local `.env` file is ignored by Git and
is not available to GitHub Actions. Only use the API key here, never your Last.fm
shared secret.

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
