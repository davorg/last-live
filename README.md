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

## Live Demo

Check out the live site here: [Last Live](https://davorg.dev/last-live/)

## Getting Started

### Prerequisites

- Node.js and npm installed on your system.

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
   npm install
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

### Deploying to GitHub Pages

Add a repository Actions secret named `VITE_LASTFM_API_KEY` in GitHub's
**Settings → Secrets and variables → Actions**. The deployment workflow passes
this secret to the build and stops if it is missing.

Vite embeds the key in the browser bundle at build time, so adding or changing
the secret requires a new deployment. A local `.env` file is ignored by Git and
is not available to GitHub Actions. Only use the API key here, never your Last.fm
shared secret.

## License

This project is open-source and available under the [MIT License](LICENSE).
