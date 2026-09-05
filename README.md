# Piano Accompaniment Studio

Piano Accompaniment Studio uses AI to create editable, playable piano accompaniment scores.

## Background

Many songs are available only as guitar chord-sheet images. Converting them into piano accompaniment requires transcription, music theory, and arrangement work. This project uses AI to extract the chart, lets the user correct the result, and generates a simple score that can be played or exported.

## Goal

The goal is to let users name a song, describe the accompaniment they want in natural language, and receive a piano score they can edit, play, and export without arranging it manually.

## Current MVP

Use **Audio File** on the homepage to transcribe WAV recordings into piano scores. **Chord Sheet Image** is temporarily disabled; its implementation is retained.

## Features

- Upload a WAV recording, follow transcription progress, and play the result as Score or Original Piano with tempo control and seeking.
- Upload one or more chord-sheet images and choose an OpenAI model for chart extraction.
- Review and edit chords, beat durations, lyrics, and measures before generating a score.
- Add, delete, and reorder chords or measures with undo and redo support.
- Generate a piano score, adjust playback tempo, seek through the arrangement, and export it as PDF.
- Restore the current workspace from browser session storage.

## Current Architecture

```mermaid
flowchart LR
    User[User] --> App[Nuxt application]
    App -->|WAV upload| Job[Local transcription job]
    Job -->|Existing Python models + TypeScript pipeline| AudioScore[Score data + piano WAV]
    AudioScore --> Score[VexFlow score]
    AudioScore --> Playback[Shared player]
    App -->|Images and selected model| API[Nuxt server API]
    API -->|Structured extraction request| OpenAI[OpenAI Responses API]
    OpenAI -->|Validated chart data| App
    App --> Editor[Editable chord chart]
    Editor --> Arrangement[Arrangement engine]
    Arrangement --> Score[VexFlow score]
    Arrangement --> Playback
```

The server sends uploaded images to the OpenAI Responses API and validates the structured result with Zod. The browser editor is the source of truth after extraction, so users can correct recognition errors before arrangement generation. The arrangement engine converts confirmed four-beat measures into deterministic piano events used by both score rendering and playback.

**Stack:** Nuxt 3, Vue 3, TypeScript, OpenAI Responses API, Zod, VexFlow, Web Audio API, Vitest, and Playwright.

## Current Design Trade-offs

| Decision | Benefit | Limitation |
| --- | --- | --- |
| AI chart extraction | Reduces manual transcription | Results are non-deterministic and require review |
| Editable intermediate chart | Recognition errors can be fully corrected | Adds a review step before score generation |
| Deterministic arrangement patterns | Produces predictable notation and playback | Provides less musical variation than manual arrangement |
| Browser session storage | Requires no account or database | Work is not synchronized across devices or browser sessions |

## Setup

```bash
npm install
cp .env.example .env
```

Add an OpenAI API key to `.env`:

```dotenv
NUXT_OPENAI_API_KEY=your_api_key
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Nuxt. Click the upload area or drop a WAV (up to 100 MB), then select **Create Score**. Click or drop again to replace the file; use × to remove it. The image workflow is currently unavailable.

Audio transcription runs on the Node server using the existing local Python/model installation and `ffmpeg`, just like `npm run audio:score`. An OpenAI key is needed only for image extraction. This is a local, single-server MVP—not a serverless or authenticated public service. Run commands from the project root, with development dependencies installed.

Only one recording is processed at a time. Refreshing the browser reconnects to the job while the server remains running. Cancelling stops that job's model processes; restarting the server stops active jobs and clears its job list. Uploaded recordings, generated files, and `pipeline.log` are stored under `.data/audio-scores/<job-id>/` (ignored by Git; no automatic deletion).

The website serves its own audio with byte-range support. It does **not** need the separate preview server below.

## Audio-to-score MVP

Run the MVP with one WAV path:

```bash
npm run audio:score -- "/absolute/path/to/recording.wav"
```

The command creates or overwrites `.audio-score/<recording-name>/` beside the WAV file.

Serve the project directory to view and play generated scores:

```bash
npm run audio:score:serve
```

Open `http://127.0.0.1:3200/.audio-score/<recording-name>/index.html`.

Project samples:

```bash
npm run audio:score -- "./安靜.wav"
npm run audio:score -- "./楓.wav"
npm run audio:score:verify
```

## Testing

```bash
npm test
npm run test:e2e
npm run test:e2e:live
```

- `npm test` runs unit and component tests.
- `npm run test:e2e` runs Playwright with a stubbed AI API.
- `npm run test:e2e:live` runs the complete flow against the real OpenAI API and requires `NUXT_OPENAI_API_KEY`.

## Current Limitations

- Chart extraction depends on image quality and model output.
- Generated charts currently use 4/4 time and can be normalized to C major or A minor.
- The arrangement engine is intended for simple MVP accompaniment rather than professional composition.
- Piano playback downloads audio samples from an external CDN.

## Documentation

- [Test inventory](docs/test-inventory.html)
