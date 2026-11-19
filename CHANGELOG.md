# Changelog

Last Live follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.3] - 2026-11-19

- Cancel superseded searches and prevent obsolete responses from changing the
  latest results, errors or loading state.
- Show loading and empty-result messages, allow replacement searches, and clear
  previous results when starting another search.
- Preserve Last.fm API error messages, explain HTTP/connection/unreadable-response
  failures, and reject malformed artist lists before displaying them.

## [1.0.2] - 2026-11-19

- Validate usernames and artist counts before requesting data, with a documented
  app limit of 1000 artists and useful feedback beside the search controls.
- Trim usernames and safely encode request parameters for direct or custom
  client endpoints, preventing username text from altering other parameters.
- Separate the API client, request state, UI sections and shared image export
  logic while preserving existing app behaviour and saved data.

## [1.0.1] - 2026-11-19

- Use Node.js 24 LTS consistently for local development and CI.
- Refresh runtime dependencies and the supported Vite, React plugin and ESLint
  toolchain, retaining the existing browser build targets.
- Use Vite's native environment-file loading.
- Update deployment Actions and add weekly Dependabot checks for npm and Actions.

## [1.0.0] - 2026-11-19

First versioned release of Last Live, establishing the existing app as the
compatibility baseline.

- Fetch top artists from Last.fm by username, time period and artist count.
- Track artists seen live and show summary statistics and a chart.
- Save marks in the browser, migrate legacy data and handle storage failures.
- Download artist lists and results as images.
- Display the app version from `package.json` in the footer.
