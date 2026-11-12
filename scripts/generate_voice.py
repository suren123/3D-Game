#!/usr/bin/env python3
"""Generate the game's static Mandarin prompts with edge-tts 7.3.1.

Run with a Python environment containing edge-tts; Node.js reads the game's
canonical dialogue, and ffprobe validates every MP3. Generation needs network
access; the resulting website only plays local files. --probe generates one
line to check service access. --verify-only checks all outputs without network.
"""

import argparse
import asyncio
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "audio" / "voice"
VOICE = "zh-CN-XiaoxiaoNeural"
RATE = "-10%"
VOLUME = "-10%"
ATTEMPTS = 3


def dialogue():
    """Read the JS data directly so dialogue cannot silently drift apart."""
    source = """
      import { LOCATIONS, MISSIONS } from './src/game.js';
      const lines = Object.values(LOCATIONS).map(place => ({
        text: `出发去${place.name}！`, file: `go-${place.id}.mp3`
      }));
      for (const mission of MISSIONS) {
        mission.steps.forEach((step, index) => {
          lines.push({text: step.arrival, file: `arrive-${mission.id}-${index}.mp3`});
          lines.push({text: step.celebration, file: `reward-${mission.id}-${index}.mp3`});
        });
      }
      lines.push({
        text: '点一点目的地，小车自己开。到站后，点大按钮帮个忙吧！',
        file: 'help.mp3'
      });
      console.log(JSON.stringify(lines));
    """
    result = subprocess.run(
        ["node", "--input-type=module", "-e", source],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


def valid_audio(path):
    if not path.is_file() or path.stat().st_size == 0:
        return False
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "stream=codec_name:format=duration", "-of", "json", str(path)],
            check=True, capture_output=True, text=True, timeout=10,
        )
        data = json.loads(result.stdout)
        return (float(data.get("format", {}).get("duration", 0)) > 0
                and any(stream.get("codec_name") == "mp3"
                        for stream in data.get("streams", [])))
    except (subprocess.SubprocessError, ValueError, OSError):
        return False


def save_manifest(manifest):
    descriptor, temporary = tempfile.mkstemp(prefix=".manifest-", suffix=".json", dir=OUTPUT)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temporary, OUTPUT / "manifest.json")
    finally:
        Path(temporary).unlink(missing_ok=True)


def safe_error(error):
    # Network exceptions may contain signed URLs or proxy credentials.
    # Print only the class and an optional HTTP status, never their full string.
    status = getattr(error, "status", None)
    return type(error).__name__ + (f" (HTTP {status})" if status else "")


async def generate_line(line, proxy):
    import edge_tts

    for attempt in range(1, ATTEMPTS + 1):
        descriptor, temporary = tempfile.mkstemp(prefix=".voice-", suffix=".mp3", dir=OUTPUT)
        os.close(descriptor)
        try:
            speech = edge_tts.Communicate(
                line["text"], VOICE, rate=RATE, volume=VOLUME,
                proxy=proxy, connect_timeout=10, receive_timeout=20,
            )
            await asyncio.wait_for(speech.save(temporary), timeout=35)
            if not valid_audio(Path(temporary)):
                raise ValueError("The service did not produce a valid MP3")
            os.replace(temporary, OUTPUT / line["file"])
            print(f"Generated {line['file']}", flush=True)
            return True
        except Exception as error:
            print(f"Attempt {attempt}/{ATTEMPTS} for {line['file']}: {safe_error(error)}", flush=True)
            if attempt < ATTEMPTS:
                await asyncio.sleep(attempt * 2)
        finally:
            Path(temporary).unlink(missing_ok=True)
    return False


async def run(args):
    for executable in ("node", "ffprobe"):
        if not shutil.which(executable):
            raise RuntimeError(f"Required executable missing: {executable}")
    lines = dialogue()
    existing = {}
    manifest_path = OUTPUT / "manifest.json"
    if manifest_path.is_file():
        try:
            loaded = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                existing = loaded
        except (ValueError, OSError):
            pass
    # Only keep entries whose current source text matches a verified file.
    manifest = {
        line["text"]: line["file"] for line in lines
        if existing.get(line["text"]) == line["file"] and valid_audio(OUTPUT / line["file"])
    }
    if args.verify_only:
        print(f"Verified {len(manifest)}/{len(lines)} current dialogue MP3 files")
        return 0 if len(manifest) == len(lines) else 1

    import edge_tts.communicate as communication

    # edge-tts 7.3.1 passes its certifi SSLContext explicitly to ws_connect,
    # overriding a connector's context. Extend its trusted CA set with the
    # system trust store (including a managed cloud's proxy CA); retain strict
    # hostname and certificate verification. No TLS checks are disabled.
    context = getattr(communication, "_SSL_CTX", None)
    if not isinstance(context, ssl.SSLContext):
        raise RuntimeError("Unsupported edge-tts TLS context; review the installed version")
    context.load_default_certs()
    if not context.check_hostname or context.verify_mode != ssl.CERT_REQUIRED:
        raise RuntimeError("Strict TLS verification is required")

    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    selected = lines[:1] if args.probe else lines
    generated = 0
    for line in selected:
        if line["text"] in manifest:
            print(f"Verified existing {line['file']}", flush=True)
            continue
        if not await generate_line(line, proxy):
            save_manifest(manifest)
            print(f"Stopped after service failure: {len(manifest)}/{len(lines)} valid files", flush=True)
            return 1
        manifest[line["text"]] = line["file"]
        generated += 1
        save_manifest(manifest)
    save_manifest(manifest)
    print(f"Finished: {generated} generated; {len(manifest)}/{len(lines)} valid files", flush=True)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--probe", action="store_true", help="Generate only the first prompt")
    group.add_argument("--verify-only", action="store_true", help="Verify current MP3 files without network")
    args = parser.parse_args()
    try:
        raise SystemExit(asyncio.run(run(args)))
    except (ImportError, RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(f"Voice generation blocked: {safe_error(error)}")
        raise SystemExit(1)
