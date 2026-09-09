# TODO

Items are ordered by recommended implementation priority.

## Public demo

- [x] Fix the production build failure that cannot resolve `shared/audio-transcription/job.ts`.
- [x] Package Nuxt, Python, ffmpeg, dependencies, and model setup into a reproducible deployment environment.
- [ ] Measure processing time, memory, CPU, and disk usage with five- to six-minute recordings.
- [ ] Deploy Nuxt and the Python pipeline together on one non-sleeping VM or container service.
- [ ] Protect the demo with a shared password or invite code.
- [ ] Clearly explain when another transcription is already running.
- [ ] Automatically delete uploaded audio, logs, and generated files after a defined retention period.
- [ ] Verify upload, progress, cancellation, score playback, seeking, Original Piano playback, and PDF export in the deployed environment.
- [ ] Use self-recorded, licensed, or otherwise permitted audio for public examples.

## Product quality

- [ ] Build a fixed validation set covering at least 10–20 songs, including different arrangements and recording qualities.
- [ ] Track missing notes, extra notes, repeated-strike errors, sustain errors, processing failures, and processing time.
- [ ] Support common input formats such as MP3 and M4A by converting them on the server.
- [ ] Add a minimal score correction workflow:
  - [ ] Add and delete notes.
  - [ ] Change pitch, start position, and duration.
  - [ ] Loop and compare a selected measure with the original piano audio.
  - [ ] Support undo and redo.

## Paid product

- [ ] Add user accounts and enforce ownership of jobs, audio, and scores.
- [ ] Save projects so users can return and continue editing on another device.
- [ ] Persist job state in a database and audio artifacts in private object storage.
- [ ] Move long-running transcription into a persistent queue and worker with retry, cancellation, timeout, and restart recovery.
- [ ] Add autosave and revision recovery for score edits.
- [ ] Add plans, usage limits, payment, refunds for failed jobs, and billing records.
- [ ] Add upload rate limits, private download URLs, file validation, secret management, and retention controls.
- [ ] Add production logging, error monitoring, resource monitoring, backups, health checks, and rollback procedures.
- [ ] Prepare terms of service, a privacy policy, data deletion controls, and a copyright-handling process before accepting commercial recordings.

## Later

- [ ] Allow multiple users to submit transcription jobs. Requests are currently rejected while one job is running; decide queue behavior and concurrency based on available resources.
- [ ] Reuse completed results when the same audio is uploaded again. Compare file content and transcription settings/model versions; currently every upload runs the full pipeline again.
- [ ] Let users enter a song title and artist instead of preparing an audio file themselves.
- [ ] Evaluate additional score types only after the piano-score workflow is validated.
- [ ] Consider advanced notation editing only when the target users demonstrate a need for it.

## Current technical constraints

- The server accepts only one transcription at a time and rejects additional requests instead of queuing them.
- Job records exist only in server memory and disappear after a restart.
- Uploaded audio, generated files, and logs remain on the local filesystem until manually removed.
- Docker prepares the runtime and models automatically; the first start requires internet access to download models.
- Audio-score playback depends on piano samples hosted by an external CDN.
