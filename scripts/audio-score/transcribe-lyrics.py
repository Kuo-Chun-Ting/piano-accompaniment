import argparse
import json
from pathlib import Path
from collections.abc import Iterable
from typing import Protocol

from faster_whisper import WhisperModel


class WhisperSegment(Protocol):
    start: float
    end: float
    text: str
    no_speech_prob: float


def main() -> int:
    args = parse_args()
    output_path = Path(args.output).resolve()
    model_cache = Path(args.model_cache).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model_cache.mkdir(parents=True, exist_ok=True)

    model = WhisperModel(
        args.model,
        device="cpu",
        compute_type="int8",
        download_root=str(model_cache),
    )
    segments, info = model.transcribe(
        str(Path(args.input).resolve()),
        beam_size=5,
        condition_on_previous_text=False,
        temperature=0,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        word_timestamps=False,
    )
    result = {
        "language": info.language,
        "languageProbability": round(info.language_probability, 4),
        "segments": build_segments(segments),
    }
    output_path.write_text(f"{json.dumps(result, ensure_ascii=False, indent=2)}\n")
    return 0


def build_segments(segments: Iterable[WhisperSegment]) -> list[dict[str, float | str]]:
    result: list[dict[str, float | str]] = []
    for segment in segments:
        text = " ".join(segment.text.split())
        if not text or segment.end <= segment.start or segment.no_speech_prob >= 0.6:
            continue
        result.append({
            "startSeconds": round(segment.start, 3),
            "endSeconds": round(segment.end, 3),
            "text": text,
        })
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--model-cache", required=True)
    return parser.parse_args()


if __name__ == "__main__":
    raise SystemExit(main())
