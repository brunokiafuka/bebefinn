"""Pre-render every spoken line to voice/*.mp3 with a neural TTS voice.
Usage: python3 tools/make_voice.py  (reads tools/phrases.json, needs `pip install edge-tts`)"""
import asyncio, hashlib, json, os, re
import edge_tts

VOICE, RATE, PITCH = 'en-US-AvaNeural', '-7%', '+2Hz'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'voice')

def key(t): return re.sub(r'\s+', ' ', t.strip().lower())
def spoken(t): return re.sub(r'\blittle ([a-z])\b', lambda m: 'little ' + m.group(1).upper(), t)

async def render(text, path, sem):
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(spoken(text), VOICE, rate=RATE, pitch=PITCH).save(path)
                return
            except Exception as e:
                await asyncio.sleep(1 + attempt * 2)
        print('FAILED', text)

async def main():
    os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(os.path.join(ROOT, 'tools', 'phrases.json')))
    index, jobs, sem = {}, [], asyncio.Semaphore(8)
    for t in lines:
        k = key(t)
        f = hashlib.sha1(f'{VOICE}|{RATE}|{k}'.encode()).hexdigest()[:12] + '.mp3'
        index[k] = f
        p = os.path.join(OUT, f)
        if not os.path.exists(p) or os.path.getsize(p) == 0:
            jobs.append(render(t, p, sem))
    await asyncio.gather(*jobs)
    index = {k: f for k, f in index.items() if os.path.exists(os.path.join(OUT, f))}
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'), sort_keys=True)
    keep = set(index.values()) | {'index.json'}
    for f in os.listdir(OUT):
        if f not in keep: os.remove(os.path.join(OUT, f))
    print(len(index), 'clips')

asyncio.run(main())
