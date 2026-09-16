"""Local-only speech timing inspection for the supplied Unit 1 recording."""
from pathlib import Path
import sys, subprocess, json, wave
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.tools/audio'))
import imageio_ffmpeg
import vosk
import numpy as np

source = Path(sys.argv[1])
unit = sys.argv[2] if len(sys.argv) > 2 else 'unit1'
work = ROOT / '.audio-work'
work.mkdir(exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-ac', '1', '-ar', '16000', str(work / f'{unit}.wav')], check=True)
with wave.open(str(work / f'{unit}.wav'), 'rb') as reader:
    pcm = reader.readframes(reader.getnframes())
samples = np.frombuffer(pcm, dtype=np.int16).astype(float) / 32768
frame = 160
rms = np.sqrt(np.mean(samples[:len(samples)//frame*frame].reshape(-1, frame)**2, axis=1))
active = np.where(rms > 0.009)[0]
groups = []
for i in active:
    if not groups or i - groups[-1][-1] > 25:
        groups.append([int(i)])
    else:
        groups[-1].append(int(i))
spans = [[round(g[0]*.01, 2), round((g[-1]+1)*.01, 2)] for g in groups if len(g) > 5]
print('Duration:', round(len(samples)/16000, 3), 'seconds')
print('Speech energy intervals:', spans)
vosk.SetLogLevel(-1)
model = vosk.Model('.tools/models/vosk-model-small-en-us-0.15')
recognizer = vosk.KaldiRecognizer(model, 16000)
recognizer.SetWords(True)
results = []
for start in range(0, len(pcm), 8000):
    if recognizer.AcceptWaveform(pcm[start:start+8000]):
        results.append(json.loads(recognizer.Result()))
results.append(json.loads(recognizer.FinalResult()))
(work / f'{unit}-recognition.json').write_text(json.dumps({'duration': len(samples)/16000, 'energy_spans': spans, 'results': results}, indent=2), encoding='utf8')
for result in results:
    print(json.dumps(result))
