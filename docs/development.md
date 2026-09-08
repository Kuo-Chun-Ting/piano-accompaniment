# Development Guide

## Models

Both local development and Docker need downloaded model files. See [runtime.ts](../shared/audio-transcription/runtime.ts) for the required files and folder structure. There is no model setup script yet. The first transcription may download additional model files.

Docker reads models from `.audio-score-models/` at the project root by default. To use another folder, copy `.env.example` to `.env` and set an absolute path:

```dotenv
AUDIO_SCORE_MODELS_DIR="${HOME}/Library/Application Support/Piano Accompaniment/audio-score/models"
PORT=3200
```

On Linux, use your Linux model path. If you copy models, preserve their symbolic links. The container user (UID 1000) needs write access to the folder to store caches.

`.env` is ignored by Git. Use `.env.example` as the shared settings template.

## Local Python Runtime

Install ffmpeg and make it available on PATH. Create a Python virtual environment named `venv` at the location below and install [requirements.txt](../scripts/audio-score/requirements.txt) in it. Place the model files in the adjacent `models/` folder.

- macOS: `~/Library/Application Support/Piano Accompaniment/audio-score/`
- Linux: `~/.local/share/piano-accompaniment/audio-score/`

Docker installs its own runtime. Do not copy a macOS virtual environment into a Linux container.

## Command-line Transcription

The CLI (command-line interface) runs transcription without the website. Use it to develop and debug the pipeline. It requires the local Python runtime and models.

From the project root:

```bash
npm run audio:score -- "./recording.wav"
```

This creates or overwrites `.audio-score/recording/` beside the WAV file. If the WAV is in the project root, stop the website and start the preview server:

```bash
npm run audio:score:serve
```

Open [the generated score](http://127.0.0.1:3200/.audio-score/recording/index.html). This server serves only files inside the project directory.

To verify the sample outputs, place `安靜.wav` and `楓.wav` in the project root, then run:

```bash
npm run audio:score -- "./安靜.wav"
npm run audio:score -- "./楓.wav"
npm run audio:score:verify
```

The source recordings are not included in Git. The verification script uses the tracked reference audio in `tests/fixtures/audio/`.

## Docker Data and Logs

View server logs:

```bash
docker compose logs -f web
```

The server stores uploads, results, and logs in `.data/audio-scores/<job-id>/`. Docker stores this directory in the `audio-score-data` volume. Stopping or rebuilding the container keeps these files. `docker compose down -v` deletes them.

The job list is held in memory. Keeping the files does not restore jobs after a server restart.
