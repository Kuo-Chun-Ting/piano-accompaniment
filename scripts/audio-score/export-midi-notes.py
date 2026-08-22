import argparse
import json
from collections import defaultdict, deque
from pathlib import Path

import mido


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export paired MIDI notes as JSON.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def export_notes(input_path: Path) -> dict:
    midi = mido.MidiFile(input_path)
    active = defaultdict(deque)
    notes = []
    pedal_events = []
    elapsed_seconds = 0.0
    unmatched_note_off = 0

    for message in midi:
        elapsed_seconds += message.time
        channel = getattr(message, "channel", 0)
        midi_number = getattr(message, "note", -1)
        key = (channel, midi_number)

        if message.type == "control_change" and message.control == 64:
            pedal_events.append({
                "timeSeconds": round(elapsed_seconds, 6),
                "value": message.value,
            })
            continue

        if message.type == "note_on" and message.velocity > 0:
            active[key].append((elapsed_seconds, message.velocity))
            continue

        is_note_off = message.type == "note_off" or (
            message.type == "note_on" and message.velocity == 0
        )
        if not is_note_off:
            continue

        if not active[key]:
            unmatched_note_off += 1
            continue

        start_seconds, velocity = active[key].popleft()
        notes.append({
            "midi": midi_number,
            "startSeconds": round(start_seconds, 6),
            "endSeconds": round(elapsed_seconds, 6),
            "velocity": velocity,
        })

    stuck_note_on = sum(len(starts) for starts in active.values())
    notes.sort(key=lambda note: (note["startSeconds"], note["midi"], note["endSeconds"]))
    return {
        "durationSeconds": round(midi.length, 6),
        "ticksPerBeat": midi.ticks_per_beat,
        "notes": notes,
        "pedalEvents": pedal_events,
        "validation": {
            "unmatchedNoteOff": unmatched_note_off,
            "stuckNoteOn": stuck_note_on,
        },
    }


def main() -> int:
    args = parse_args()
    if not args.input.is_file():
        raise FileNotFoundError(f"MIDI input does not exist: {args.input}")

    result = export_notes(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "notes": len(result["notes"]),
        "pedalEvents": len(result["pedalEvents"]),
        **result["validation"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
