# Development Guide

## Models

Docker downloads missing models into the `audio-score-models` volume before starting Nuxt. No host model directory or API key is needed. `AUDIO_SCORE_MODELS_DIR` is no longer used by Compose; existing host model files are left untouched.

[models.json](../scripts/audio-score/models.json) pins download URLs and SHA256 hashes for BS-RoFormer, All-In-One (including its Demucs dependency), and Whisper. TransKun includes its weights in the installed package. The downloads use the same upstream sources as the inference packages; their licenses still apply.

[prepare-models.py](../scripts/audio-score/prepare-models.py) verifies existing files, replaces corrupt files, and publishes downloads only after checksum validation. It prepares Hugging Face snapshot directories and pins `refs/main` after all files pass. The server starts with `HF_HUB_OFFLINE=1` so inference uses these snapshots without updating them. A failed download prevents startup and is reported in the container logs.

For local development, use the same setup script with your local runtime's model directory. On macOS:

```bash
python3 scripts/audio-score/prepare-models.py \
  --models-dir "$HOME/Library/Application Support/Piano Accompaniment/audio-score/models" \
  -- npm run dev -- --port 3200
```

On Linux, use `~/.local/share/piano-accompaniment/audio-score/models`. Python dependencies and ffmpeg must be installed first for local development; Docker installs them during its build.

## Local Python Runtime

Install ffmpeg and make it available on PATH. Create a Python virtual environment named `venv` at the location below and install [requirements.txt](../scripts/audio-score/requirements.txt) in it. The setup script above prepares the adjacent `models/` folder.

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

The server stores uploads, results, and logs in `.data/audio-scores/<job-id>/`. Docker stores this directory in the `audio-score-data` volume and models in `audio-score-models`. Stopping or rebuilding the container keeps both volumes. **`docker compose down -v` deletes both the data and downloaded models.**

The job list is held in memory. Keeping the files does not restore jobs after a server restart.
