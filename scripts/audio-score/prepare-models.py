import argparse
import fcntl
import hashlib
import json
import os
import ssl
import sys
import time
from pathlib import Path
from typing import TypedDict
from urllib.request import urlopen


class ModelFile(TypedDict):
    path: str
    url: str
    sha256: str


class CacheReference(TypedDict):
    path: str
    revision: str


class ModelManifest(TypedDict):
    files: list[ModelFile]
    references: list[CacheReference]


def prepare_models(directory: Path, manifest: ModelManifest) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    # Only one process may publish models and cache references into this volume.
    with (directory / '.setup.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for asset in manifest['files']:
            ensure_file(directory, asset)
        for reference in manifest['references']:
            publish_reference(directory, reference)
    print('Models ready.', flush=True)


def ensure_file(directory: Path, asset: ModelFile) -> None:
    destination = resolve_destination(directory, asset['path'])
    if destination.is_file() and hash_file(destination) == asset['sha256']:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.part')
    # A killed download may leave a partial file. Never resume or load it blindly.
    temporary.unlink(missing_ok=True)
    print(f"Downloading {asset['path']}...", flush=True)
    try:
        download_file(asset['url'], temporary)
        if hash_file(temporary) != asset['sha256']:
            raise ValueError(f"SHA256 mismatch: {asset['path']}")
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)


def download_file(url: str, destination: Path) -> None:
    for attempt in range(3):
        try:
            stream_download(url, destination)
            return
        except (OSError, TimeoutError) as error:
            if attempt == 2:
                raise RuntimeError(f'Download failed: {url}: {error}') from error
            print(f'Download interrupted; retrying ({attempt + 1}/2).', flush=True)
            time.sleep(1)


def stream_download(url: str, destination: Path) -> None:
    context = ssl.create_default_context()
    with urlopen(url, timeout=60, context=context) as response, destination.open('wb') as output:
        downloaded = 0
        next_report = 64 * 1024 * 1024
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
            downloaded += len(chunk)
            if downloaded >= next_report:
                print(f'  {downloaded // (1024 * 1024)} MB downloaded', flush=True)
                next_report += 64 * 1024 * 1024


def hash_file(path: Path) -> str:
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def resolve_destination(directory: Path, relative_path: str) -> Path:
    destination = directory / relative_path
    if not destination.resolve().is_relative_to(directory.resolve()):
        raise ValueError(f'Path is outside model directory: {relative_path}')
    return destination


def publish_reference(directory: Path, reference: CacheReference) -> None:
    # Hugging Face resolves the packages' default "main" to our verified snapshot.
    destination = resolve_destination(directory, reference['path'])
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.part')
    temporary.write_text(reference['revision'])
    temporary.replace(destination)


def main() -> None:
    parser = argparse.ArgumentParser(description='Prepare verified transcription models.')
    parser.add_argument('--models-dir', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, default=Path(__file__).with_name('models.json'))
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    try:
        manifest: ModelManifest = json.loads(args.manifest.read_text())
        prepare_models(args.models_dir, manifest)
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print(f'Model setup failed: {error}', file=sys.stderr, flush=True)
        sys.exit(1)
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if command:
        # Prevent inference packages from silently replacing the pinned snapshots.
        os.environ['HF_HUB_OFFLINE'] = '1'
        os.execvp(command[0], command)


if __name__ == '__main__':
    main()
