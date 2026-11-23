"""Google TTS seslendirme.

Öncelik sırası:
  1. Google Cloud Text-to-Speech (GOOGLE_TTS_API_KEY ortam değişkeni varsa) –
     WaveNet / Neural2 / Chirp3-HD Türkçe sesler, en doğal sonuç.
  2. Google Translate TTS (anahtarsız, gTTS'in kullandığı Google sesi).
Çıktı: 48 kHz mono WAV, sesi temizlenmiş (high-pass, kompresör, presence EQ).
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import subprocess
import tempfile
import time
from pathlib import Path

import requests

CACHE = Path(os.environ.get("SHORTS_CACHE", Path(__file__).resolve().parent.parent / ".cache")) / "tts"

VOICE_FILTER = (
    "highpass=f=75,"
    "acompressor=threshold=-20dB:ratio=3.5:attack=4:release=90:makeup=4,"
    "equalizer=f=220:t=q:w=1.2:g=1.5,"
    "equalizer=f=3200:t=q:w=1.0:g=3,"
    "equalizer=f=9000:t=q:w=1.0:g=1.5,"
    "alimiter=limit=0.89"
)


def _split(text: str, limit: int = 180) -> list[str]:
    parts, cur = [], ""
    for sent in re.split(r"(?<=[.!?…,;:])\s+", text.strip()):
        if len(cur) + len(sent) + 1 <= limit:
            cur = f"{cur} {sent}".strip()
        else:
            if cur:
                parts.append(cur)
            while len(sent) > limit:
                cut = sent.rfind(" ", 0, limit)
                cut = cut if cut > 0 else limit
                parts.append(sent[:cut])
                sent = sent[cut:].strip()
            cur = sent
    if cur:
        parts.append(cur)
    return parts


def _ffmpeg(args: list[str]):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def _cloud(text: str, cfg: dict, out_raw: Path):
    key = os.environ["GOOGLE_TTS_API_KEY"]
    body = {
        "input": {"text": text},
        "voice": {"languageCode": cfg.get("language", "tr-TR"), "name": cfg.get("voice", "tr-TR-Wavenet-B")},
        "audioConfig": {
            "audioEncoding": "LINEAR16",
            "sampleRateHertz": 48000,
            "speakingRate": cfg.get("cloud_rate", 1.12),
            "pitch": cfg.get("pitch", 0.0),
        },
    }
    r = requests.post(
        "https://texttospeech.googleapis.com/v1/text:synthesize",
        headers={"X-Goog-Api-Key": key, "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=60,
    )
    r.raise_for_status()
    out_raw.write_bytes(base64.b64decode(r.json()["audioContent"]))


def _translate(text: str, cfg: dict, out_raw: Path):
    lang = cfg.get("language", "tr-TR").split("-")[0]
    files = []
    with tempfile.TemporaryDirectory() as td:
        for i, chunk in enumerate(_split(text)):
            for attempt in range(4):
                try:
                    r = requests.get(
                        "https://translate.googleapis.com/translate_tts",
                        params={"client": "gtx", "ie": "UTF-8", "tl": lang, "q": chunk, "ttsspeed": 1},
                        headers={"User-Agent": "Mozilla/5.0"},
                        timeout=30,
                    )
                    r.raise_for_status()
                    if not r.content:
                        raise RuntimeError("boş ses")
                    break
                except Exception:
                    if attempt == 3:
                        raise
                    time.sleep(1.5 * (attempt + 1))
            f = Path(td) / f"p{i}.mp3"
            f.write_bytes(r.content)
            files.append(f)
        lst = Path(td) / "l.txt"
        lst.write_text("".join(f"file '{f}'\n" for f in files))
        _ffmpeg(["-f", "concat", "-safe", "0", "-i", str(lst), "-ar", "48000", "-ac", "1", str(out_raw)])


def engine_name() -> str:
    return "google-cloud-tts" if os.environ.get("GOOGLE_TTS_API_KEY") else "google-translate-tts"


def synthesize(text: str, out_wav: Path, cfg: dict | None = None) -> Path:
    """text → temizlenmiş 48k mono wav. Sonuç önbelleğe alınır."""
    cfg = cfg or {}
    eng = engine_name()
    speed = cfg.get("speed", 1.0 if eng == "google-cloud-tts" else 1.28)
    h = hashlib.sha1(json.dumps([text, eng, cfg.get("voice"), speed, cfg.get("cloud_rate"), VOICE_FILTER], ensure_ascii=False).encode()).hexdigest()[:16]
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{h}.wav"
    if not cached.exists():
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / "raw.wav"
            (_cloud if eng == "google-cloud-tts" else _translate)(text, cfg, raw)
            filt = VOICE_FILTER
            if abs(speed - 1.0) > 1e-3:
                filt = f"atempo={speed}," + filt
            # baş/son sessizliği kırp
            filt = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
                    "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,") + filt
            _ffmpeg(["-i", str(raw), "-af", filt, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(cached)])
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    out_wav.write_bytes(cached.read_bytes())
    return out_wav
