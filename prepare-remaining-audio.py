"""Cut the three supplied G1 recordings using locally verified word timings."""
from pathlib import Path
import sys, json, subprocess, hashlib
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.tools/audio'))
import imageio_ffmpeg
base = Path(sys.argv[1])
lessons = {
    2: ('16 U2 Our Classroom-4 SW.mp3', ['they','we','and','your','his','her','that','our','their','my','open','close']),
    3: ('23 U3 People in Our School-4 SW.mp3', ['in','school','who','hello','good','too','first grade','yes','no','not']),
    4: ('29 U4 Whose？-3 SW.mp3', ['whose','yellow','green','color','red','orange','white','pink','blue','black']),
}
homophones = {'their':'there', 'too':'two', 'whose':"who's", 'red':'read'}
for unit, (name, words) in lessons.items():
    source = base / name
    analysis = json.loads((ROOT / f'.audio-work/unit{unit}-recognition.json').read_text(encoding='utf8'))
    phrases = [result for result in analysis['results'] if result.get('text')]
    assert phrases.pop(0)['text'] == 'sight words'
    assert len(phrases) == len(words)
    output = ROOT / f'audio/unit{unit}'
    output.mkdir(exist_ok=True)
    manifest = []
    for index, (word, phrase) in enumerate(zip(words, phrases)):
        assert phrase['text'] in [word, homophones.get(word)], (word, phrase['text'])
        start = round(max(0, phrase['result'][0]['start'] - .23), 3)
        end = round(min(analysis['duration'], phrase['result'][-1]['end'] + .20), 3)
        if index + 1 < len(phrases):
            assert end < phrases[index+1]['result'][0]['start'] - .23
        destination = output / (word.replace(' ', '-') + '.mp3')
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-ss', str(start), '-t', str(round(end-start,3)), '-map_metadata', '-1', '-ac', '1', '-codec:a', 'libmp3lame', '-q:a', '2', str(destination)], check=True)
        manifest.append({'word':word,'start':start,'end':end,'file':destination.relative_to(ROOT).as_posix(),'recognized':phrase['text']})
    (ROOT / f'.audio-work/unit{unit}-cuts.json').write_text(json.dumps({'source_name':name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'segments':manifest},ensure_ascii=False,indent=2),encoding='utf8')
    print(f'Unit {unit}: {len(manifest)} clips; '+', '.join(words))
