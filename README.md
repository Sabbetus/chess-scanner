# Chess Scanner

Photograph a handwritten chess tournament scoresheet, get back a validated PGN, and (optionally)
push it straight into a lichess study — without retyping a single move.

## Privacy model

This is a static site with **no backend**. Nothing you scan is ever stored in this repository or
on any server the app author controls:

- **Scoresheet photos** never leave your device except as direct API calls to Anthropic (for OCR)
  from your own browser, using your own API key.
- **Your Anthropic API key** and **lichess login token** are stored only in `localStorage` in your
  browser. They are never sent anywhere except `api.anthropic.com` and `lichess.org` respectively.
- Because this is a public repo/site, **each visitor supplies their own Anthropic API key** — no
  key is bundled with the app, so nobody can spend your tokens. If you don't advertise the site,
  in practice you're the only one who will ever open it and paste in a key.
- A strict Content-Security-Policy limits outbound requests to `api.anthropic.com` and
  `lichess.org` only — no analytics, no third-party scripts.
- Settings has a "Clear all local data" button that wipes everything in one click.

## How it works

1. **Capture** — take/upload photos of your scoresheet (one per page).
2. **Scan** — the photos are sent to the Anthropic API (Claude vision) with a prompt tuned for
   English-notation scoresheets; it returns a structured move list and game metadata.
3. **Review** — moves are replayed through [chess.js](https://github.com/jhlywa/chess.js). Any
   move that isn't legal is flagged; click a move to see the board at that point, double-click to
   correct it (with ranked legal-move suggestions).
4. **Export** — once every move is legal, download/copy the PGN, or log in to lichess (OAuth2 +
   PKCE, no server involved) and import the game as a new chapter in one of your studies.

## Setup

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (vitest)
npm run build     # production build to dist/
```

You'll need:
- An [Anthropic API key](https://console.anthropic.com/settings/keys) — paste it into the app's
  Settings panel. It's stored only in your browser.
- A lichess account, if you want to export straight to a study — the "Log in to lichess" button
  handles the rest.

## Deploying

The included GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys `dist/`
to GitHub Pages on every push to `main`. To enable it:

1. In the repo, go to **Settings → Pages** and set the source to **GitHub Actions**.
2. Push to `main` — the workflow runs tests, builds, and deploys automatically.
3. Your app will be live at `https://<owner>.github.io/chess-scanner/`.

No secrets need to be configured in GitHub — the app has no server-side component.

## Tech stack

Vite + React + TypeScript, [chess.js](https://github.com/jhlywa/chess.js) for move validation,
[react-chessboard](https://github.com/Clariity/react-chessboard) for the board UI. No backend, no
database, no analytics.
