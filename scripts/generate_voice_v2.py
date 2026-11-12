#!/usr/bin/env python3
"""Generate/verify all finite V2 Mandarin clips; uses the V1 verified TLS pipeline."""
import argparse
import asyncio
import json
import subprocess
import generate_voice as base

base.OUTPUT = base.ROOT / 'public' / 'audio' / 'voice-v2'

def dialogue():
    source = "import {VOICE_LINES} from './src/v2/dialogue.js'; console.log(JSON.stringify(VOICE_LINES.map(x=>({text:x.text,file:x.id+'.mp3'}))))"
    result = subprocess.run(['node','--input-type=module','-e',source],cwd=base.ROOT,check=True,capture_output=True,text=True)
    return json.loads(result.stdout)

base.dialogue = dialogue
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--probe', action='store_true')
    raise SystemExit(asyncio.run(base.run(parser.parse_args())))
