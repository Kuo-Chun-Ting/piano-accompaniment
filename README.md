# Piano Accompaniment Studio

Nuxt 3 web app for turning uploaded chord-sheet screenshots into editable chord charts and generated piano accompaniment scores.

## Setup

```bash
npm install
cp .env.example .env
```

Set these values in `.env`:

```dotenv
NUXT_OPENAI_API_KEY=your_api_key
PLAYWRIGHT_HEADLESS=true
```

Models are selected in the app. Available model IDs: `gpt-5-mini`, `gpt-5.5`, `gpt-5.6-sol`.

## Development

```bash
npm run dev
```

Open the local Nuxt URL shown by the command.

## Verification

- Unit and component tests: `npm run test`
- Stubbed E2E tests: `npm run test:e2e`
- Headed E2E tests: `PLAYWRIGHT_HEADLESS=false npm run test:e2e`
- Live API E2E test: `npm run test:e2e:live`
- Typecheck: `npm run typecheck`
- Production build: `npm run build`
