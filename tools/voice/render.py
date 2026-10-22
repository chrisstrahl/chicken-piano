"""Records the chicken's lines with Kokoro-82M (open source neural TTS, runs locally, no API key).

Usage: python tools/voice/render.py build/voice-lines.json dist/voice
Only new or changed lines are recorded; clips for lines that no longer exist are deleted.
Needs: pip install -r tools/voice/requirements.txt, and ffmpeg. Model files (~350 MB) are
downloaded once into ~/.cache/chicken-piano-voice.
"""
import json, os, re, subprocess, sys, tempfile, urllib.request
from pathlib import Path

VOICE = "af_heart"   # "Warm Hen", picked by Chris on 2026-10-22
SPEED = 1.0
BITRATE = "48k"
SETTINGS = f"kokoro-v1.0/{VOICE}/{SPEED}/{BITRATE}"  # change => every clip is re-recorded

MODEL_URL = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/"
CACHE = Path(os.environ.get("VOICE_CACHE", Path.home() / ".cache/chicken-piano-voice"))
HERE = Path(__file__).parent


def model_file(name):
    p = CACHE / name
    if not p.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name} ...", flush=True)
        urllib.request.urlretrieve(MODEL_URL + name, p.with_suffix(".part"))
        p.with_suffix(".part").rename(p)
    return str(p)


def spoken(text, fixes):
    # Regex spelling fixes so the voice says letters and chicken words right (pronounce.json).
    # The clip is still keyed by the original text.
    for pattern, repl in fixes:
        if pattern.startswith("note:"):
            continue
        text = re.sub(pattern, repl.replace("$", "\\"), text)
    return text


def main(lines_path, out_dir):
    lines = json.loads(Path(lines_path).read_text())
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    man_path = out / "manifest.json"
    manifest = json.loads(man_path.read_text()) if man_path.exists() else {}
    fixes = json.loads((HERE / "pronounce.json").read_text())

    for l in lines:
        l["spoken"] = spoken(l["text"], fixes)
    todo = [l for l in lines
            if manifest.get(l["id"]) != {"text": l["text"], "spoken": l["spoken"], "settings": SETTINGS}
            or not (out / f"{l['id']}.mp3").exists()]
    if todo:
        import soundfile as sf
        from kokoro_onnx import Kokoro
        kokoro = Kokoro(model_file("kokoro-v1.0.onnx"), model_file("voices-v1.0.bin"))
        with tempfile.TemporaryDirectory() as tmp:
            for i, l in enumerate(todo, 1):
                samples, rate = kokoro.create(l["spoken"], voice=VOICE, speed=SPEED, lang="en-us")
                wav = Path(tmp) / "line.wav"
                sf.write(wav, samples, rate)
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav),
                                "-af", "loudnorm=I=-16:TP=-1.5", "-ac", "1", "-b:a", BITRATE,
                                str(out / f"{l['id']}.mp3")], check=True)
                manifest[l["id"]] = {"text": l["text"], "spoken": l["spoken"], "settings": SETTINGS}
                print(f"[{i}/{len(todo)}] {l['text']}", flush=True)

    keep = {l["id"] for l in lines}
    for gone in [k for k in manifest if k not in keep]:
        (out / f"{gone}.mp3").unlink(missing_ok=True)
        del manifest[gone]
    man_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=1) + "\n")
    print(f"{len(todo)} recorded, {len(manifest)} clips in {out}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
