"""Mixagem local: voz enviada, trilha original e MP4 compatível com TV."""
from pathlib import Path
import json
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.tmp-faturamento/video-central-neo'
OUT = ROOT / 'entregas/central-neo'
OUT.mkdir(parents=True, exist_ok=True)
AUDIO = next((ROOT / 'Importação').glob('ElevenLabs_2026-10-26T19_51_46*.mp3'))
DURATION = 88.607313


def soundtrack():
    rate = 44100
    n = int(rate * DURATION)
    timeline = np.arange(n, dtype=np.float32) / rate
    stereo = np.zeros((n, 2), dtype=np.float32)
    chords = [
        [146.832, 174.614, 220.000, 261.626],
        [116.541, 146.832, 174.614, 220.000],
        [130.813, 164.814, 196.000, 246.942],
        [130.813, 146.832, 196.000, 220.000],
    ]
    for k, start in enumerate(np.arange(0, DURATION, 5.0)):
        a = int(start * rate)
        b = min(n, int((start + 6) * rate))
        t = np.arange(b - a, dtype=np.float32) / rate
        envelope = np.minimum(1, t / 1.3) * np.minimum(1, (6 - t) / 1.7)
        for j, freq in enumerate(chords[k % 4]):
            tone = (np.sin(2 * np.pi * freq * t) + .2 * np.sin(2 * np.pi * freq * 2 * t)) * .014 * envelope / 4
            stereo[a:b, 0] += tone * (.9 if j % 2 else 1)
            stereo[a:b, 1] += tone * (1 if j % 2 else .9)
    for k, start in enumerate([9.65, 20, 34.5, 40.35, 48.75, 61, 74.55, 79]):
        a = int(start * rate)
        b = min(n, a + int(1.8 * rate))
        t = np.arange(b - a, dtype=np.float32) / rate
        freq = [587.33, 659.25, 783.99][k % 3]
        tone = np.sin(2 * np.pi * freq * t) * np.exp(-t * 4) * np.minimum(1, t / .015) * .009
        stereo[a:b, k % 2] += tone
        stereo[a:b, (k + 1) % 2] += tone * .5
    fade = np.minimum(1, timeline / 2) * np.minimum(1, (DURATION - timeline) / 2.5)
    stereo *= fade[:, None]
    with wave.open(str(WORK / 'trilha-original.wav'), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(stereo, -1, 1) * 32767).astype('<i2').tobytes())


def subtitles():
    transcript = json.loads((WORK / 'transcricao.json').read_text(encoding='utf-8'))
    def stamp(v):
        ms = round(v * 1000)
        return f'{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}'
    blocks = []
    for i, s in enumerate(transcript):
        text = s['text'].strip()
        for old, new in [('semiga', 'Cemig'), ('central NEL', 'Central NEO'), ('Central NEL', 'Central NEO'), ('UEN211', 'UEN 211'), ('da lugar', 'dá lugar'), ('em basamento', 'embasamento')]:
            text = text.replace(old, new)
        blocks.append(f'{i + 1}\n{stamp(s["start"])} --> {stamp(s["end"])}\n{text}\n')
    (OUT / 'Central-NEO-UEN-211.srt').write_text('\n'.join(blocks), encoding='utf-8')


if __name__ == '__main__':
    soundtrack()
    subtitles()
    # O áudio de voz preserva seu ritmo. A trilha fica bem abaixo da narração.
    subprocess.run([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'warning',
        '-i', str(WORK / 'imagem.mp4'), '-i', str(AUDIO), '-i', str(WORK / 'trilha-original.wav'),
        '-filter_complex',
        '[1:a]loudnorm=I=-16:TP=-1.5:LRA=7,aformat=sample_rates=48000:channel_layouts=stereo[v];'
        '[2:a]volume=2.0,aformat=sample_rates=48000:channel_layouts=stereo[m];'
        '[v][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0[a]',
        '-map', '0:v:0', '-map', '[a]',
        # Frames JPEG usam faixa completa e matriz BT.601. Entrega em faixa TV/BT.709.
        '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-profile:v', 'high', '-level:v', '4.1',
        '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709',
        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'aac', '-b:a', '256k',
        '-t', str(DURATION), '-movflags', '+faststart', '-metadata', 'title=Central NEO | UEN 211',
        str(OUT / 'Central-NEO-UEN-211.mp4')
    ], check=True)
    subprocess.run([
        'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', '52',
        '-i', str(OUT / 'Central-NEO-UEN-211.mp4'), '-frames:v', '1', '-q:v', '2',
        str(OUT / 'Central-NEO-UEN-211-capa.jpg')
    ], check=True)
    print('FINAL', OUT / 'Central-NEO-UEN-211.mp4')
