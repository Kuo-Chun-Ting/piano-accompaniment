import argparse
import json
from pathlib import Path

import librosa
import numpy as np

BINS_PER_SEMITONE = 3
LOWEST_MIDI = 21
HIGHEST_MIDI = 108
HOP_LENGTH = 256


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export per-pitch band energy as JSON.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--notes", type=Path)
    parser.add_argument("--midi", type=str)
    return parser.parse_args()


def resolve_pitches(args: argparse.Namespace) -> list[int]:
    if args.midi:
        pitches = [int(value) for value in args.midi.split(",") if value.strip()]
    elif args.notes:
        notes = json.loads(args.notes.read_text(encoding="utf-8"))["notes"]
        pitches = [note["midi"] for note in notes]
    else:
        raise ValueError("Either --notes or --midi is required")

    selected = sorted({pitch for pitch in pitches if LOWEST_MIDI <= pitch <= HIGHEST_MIDI})
    if not selected:
        raise ValueError("No pitch inside the piano range was requested")
    return selected


def export_pitch_energy(input_path: Path, pitches: list[int]) -> dict:
    samples, sample_rate = librosa.load(input_path, sr=None, mono=True)
    spectrogram = np.abs(librosa.cqt(
        y=samples,
        sr=sample_rate,
        hop_length=HOP_LENGTH,
        fmin=librosa.note_to_hz("A0"),
        n_bins=(HIGHEST_MIDI - LOWEST_MIDI + 1) * BINS_PER_SEMITONE,
        bins_per_octave=12 * BINS_PER_SEMITONE,
    ))
    frame_seconds = HOP_LENGTH / sample_rate

    def band(midi: int) -> list[float]:
        first = (midi - LOWEST_MIDI) * BINS_PER_SEMITONE
        return [
            round(float(value), 6)
            for value in spectrogram[first:first + BINS_PER_SEMITONE, :].sum(axis=0)
        ]

    return {
        "sampleRate": sample_rate,
        "hopLength": HOP_LENGTH,
        "frameSeconds": round(frame_seconds, 9),
        "startSeconds": 0.0,
        "noiseFloor": round(float(np.median(spectrogram) * BINS_PER_SEMITONE), 6),
        "pitches": [{"midi": midi, "values": band(midi)} for midi in pitches],
    }


def main() -> int:
    args = parse_args()
    if not args.input.is_file():
        raise FileNotFoundError(f"Audio input does not exist: {args.input}")

    result = export_pitch_energy(args.input, resolve_pitches(args))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "pitches": len(result["pitches"]),
        "frames": len(result["pitches"][0]["values"]),
        "frameSeconds": result["frameSeconds"],
        "noiseFloor": result["noiseFloor"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
