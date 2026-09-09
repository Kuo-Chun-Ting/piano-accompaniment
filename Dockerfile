# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS python-deps
ENV VIRTUAL_ENV=/runtime/venv
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && python -m venv "$VIRTUAL_ENV"
COPY scripts/audio-score/requirements.txt /tmp/requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    "$VIRTUAL_ENV/bin/pip" install \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r /tmp/requirements.txt \
    && "$VIRTUAL_ENV/bin/pip" check

FROM node:24-bookworm-slim AS app-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim-bookworm AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 app

COPY --from=app-build /usr/local/bin/node /usr/local/bin/node
COPY --from=python-deps /runtime/venv /runtime/venv
ENV VIRTUAL_ENV=/runtime/venv \
    AUDIO_SCORE_RUNTIME_DIR=/runtime \
    PATH="/runtime/venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3200

WORKDIR /app
COPY --from=app-build --chown=app:app /app/.output ./.output
COPY --from=app-build --chown=app:app /app/scripts/audio-score ./scripts/audio-score
RUN mkdir -p /app/.data /runtime/models \
    && chown -R app:app /app/.data /runtime/models
USER app
RUN python scripts/audio-score/check-environment.py \
    && python -c "import torch, torchaudio; assert torch.version.cuda is None, 'Expected CPU-only PyTorch'"
EXPOSE 3200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10m \
    CMD node -e "fetch('http://127.0.0.1:3200/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["python", "scripts/audio-score/prepare-models.py", "--models-dir", "/runtime/models", "--"]
CMD ["node", ".output/server/index.mjs"]
