import importlib.util
import json
import shutil
import sys
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


PACKAGES = (
    "all-in-one-infer",
    "bs-roformer-infer",
    "certifi",
    "mido",
    "setuptools",
    "soundfile",
    "torch",
    "torchaudio",
    "transkun",
)
VENV_COMMANDS = ("all-in-one-infer", "bs-roformer-infer", "transkun")


def main() -> int:
    bin_dir = Path(sys.executable).parent
    missing: list[str] = []
    package_versions: dict[str, str] = {}

    for package in PACKAGES:
        try:
            package_versions[package] = version(package)
        except PackageNotFoundError:
            missing.append(f"Python package: {package}")

    commands = {"ffmpeg": shutil.which("ffmpeg")}
    if commands["ffmpeg"] is None:
        missing.append("Executable: ffmpeg")

    for command in VENV_COMMANDS:
        path = bin_dir / command
        commands[command] = str(path) if path.is_file() else None
        if commands[command] is None:
            missing.append(f"Virtualenv executable: {command}")

    if importlib.util.find_spec("pkg_resources") is None:
        missing.append("Python module: pkg_resources (requires setuptools<81)")

    result = {
        "ok": not missing,
        "python": sys.executable,
        "pythonVersion": sys.version.split()[0],
        "packages": package_versions,
        "commands": commands,
        "missing": missing,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
