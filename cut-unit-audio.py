"""Cut Unit 1's eight vocabulary prompts; original input is never modified."""
from pathlib import Path
import sys, subprocess, json, hashlib
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.tools/audio'))
import imageio_ffmpeg
source = Path(sys.argv[1])
segments = [
    ('this', 2.80, 4.10), ('the', 4.80, 5.90),
    ('she is', 6.65, 8.55), ('I am', 9.30, 10.88),
    ('what', 11.90, 12.95), ('name', 13.65, 14.85),
    ('he is', 15.50, 17.30), ('you are', 18.00, 19.78),
]
destination = ROOT / 'audio/unit1'
destination.mkdir(parents=True, exist_ok=True)
manifest = []
for word, start, end in segments:
    target = destination / (word.lower().replace(' ', '-') + '.mp3')
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-ss', str(start), '-t', str(round(end-start, 3)), '-map_metadata', '-1', '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '2', str(target)], check=True)
    manifest.append({'word':word,'start':start,'end':end,'file':target.relative_to(ROOT).as_posix(),'bytes':target.stat().st_size})
data = {'source_name': source.name, 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'segments':manifest}
(ROOT / '.audio-work/unit1-cuts.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps(manifest, indent=2))
