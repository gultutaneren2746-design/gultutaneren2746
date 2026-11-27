"""Google TTS seslendirme.

Öncelik sırası:
  1. Google Cloud Text-to-Speech (GOOGLE_TTS_API_KEY ortam değişkeni varsa):
     - varsayılan Chirp 3 HD (insana en yakın Google sesleri, ör. tr-TR-Chirp3-HD-Charon)
     - engine="gemini": Gemini-TTS, doğal dille stil talimatı (heyecanlı, gizemli…) alır
     - engine="wavenet": eski WaveNet sesleri
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
    "deesser=i=0.35,"
    "acompressor=threshold=-20dB:ratio=3:attack=6:release=120:makeup=3.5,"
    "equalizer=f=180:t=q:w=1.0:g=2,"      # sıcaklık / göğüs sesi
    "equalizer=f=450:t=q:w=1.5:g=-1.5,"   # kutu sesi azaltma
    "equalizer=f=3200:t=q:w=1.0:g=2.5,"   # anlaşılırlık
    "equalizer=f=10000:t=q:w=1.0:g=1.5,"  # hava
    "alimiter=limit=0.89"
)


def _stretch(speed: float) -> str:
    """Formant korumalı yüksek kaliteli hızlandırma (yoksa atempo)."""
    try:
        out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
        if " rubberband " in out:
            return f"rubberband=tempo={speed}:transients=mixed:formant=preserved:pitchq=quality:window=standard"
    except Exception:
        pass
    return f"atempo={speed}"


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


# Gemini-TTS için varsayılan anlatım talimatı (sahneye özel "tone" eklenir)
DEFAULT_STYLE = (
    "Türkçe kısa video anlatıcısısın. Merak uyandıran bir belgesel anlatıcısı gibi konuş: "
    "enerjik, sıcak, samimi ve doğal. Önemli sayıları ve şaşırtıcı bilgileri hafifçe vurgula, "
    "cümle aralarında doğal nefes payı bırak, sosyal medya temposunda akıcı ve canlı ol. Robot gibi düz okuma."
)
API = "https://texttospeech.googleapis.com/v1"


def _post(body: dict) -> bytes:
    r = requests.post(f"{API}/text:synthesize",
                      headers={"X-Goog-Api-Key": os.environ["GOOGLE_TTS_API_KEY"], "Content-Type": "application/json"},
                      data=json.dumps(body), timeout=120)
    if r.status_code >= 400:
        raise RuntimeError(f"Google TTS {r.status_code}: {r.text[:300]}")
    return base64.b64decode(r.json()["audioContent"])


def _cloud(text: str, cfg: dict, out_raw: Path):
    """engine: "chirp" (varsayılan, Chirp 3 HD) | "gemini" (stil talimatlı) | "wavenet"."""
    lang = cfg.get("language", "tr-TR")
    audio = {"audioEncoding": "LINEAR16", "sampleRateHertz": 48000}
    engine = cfg.get("engine", "chirp")
    if engine == "gemini":
        style = cfg.get("style", DEFAULT_STYLE)
        if cfg.get("tone"):
            style += f" Bu bölümün tonu: {cfg['tone']}."
        body = {"input": {"text": text, "prompt": style},
                "voice": {"languageCode": lang, "name": cfg.get("voice", "Charon"), "modelName": cfg.get("model", "gemini-2.5-pro-tts")},
                "audioConfig": audio}
        try:
            out_raw.write_bytes(_post(body))
            return
        except Exception as e:  # Gemini-TTS kullanılamazsa Chirp 3 HD'ye düş
            print(f"  [tts] Gemini-TTS başarısız, Chirp 3 HD kullanılıyor: {e}")
            cfg = {**cfg, "engine": "chirp", "voice": f"{lang}-Chirp3-HD-{cfg.get('voice', 'Charon')}"}
    name = cfg.get("voice") or (f"{lang}-Chirp3-HD-Charon" if cfg.get("engine", "chirp") == "chirp" else f"{lang}-Wavenet-B")
    if "-" not in name:  # "Charon" gibi kısa ad
        name = f"{lang}-Chirp3-HD-{name}"
    audio["speakingRate"] = cfg.get("cloud_rate", 1.08)
    if "Chirp3" not in name:
        audio["pitch"] = cfg.get("pitch", 0.0)
    out_raw.write_bytes(_post({"input": {"text": text}, "voice": {"languageCode": lang, "name": name}, "audioConfig": audio}))


def list_voices(language: str = "tr-TR") -> list[dict]:
    r = requests.get(f"{API}/voices", params={"languageCode": language},
                     headers={"X-Goog-Api-Key": os.environ["GOOGLE_TTS_API_KEY"]}, timeout=30)
    r.raise_for_status()
    return r.json().get("voices", [])


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
    h = hashlib.sha1(json.dumps([text, eng, cfg, speed, VOICE_FILTER, _stretch(speed)], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{h}.wav"
    if not cached.exists():
        with tempfile.TemporaryDirectory() as td:
            raw = Path(td) / "raw.wav"
            (_cloud if eng == "google-cloud-tts" else _translate)(text, cfg, raw)
            filt = VOICE_FILTER
            if abs(speed - 1.0) > 1e-3:
                filt = f"{_stretch(speed)}," + filt
            # baş/son sessizliği kırp
            filt = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
                    "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,") + filt
            _ffmpeg(["-i", str(raw), "-af", filt, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(cached)])
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    out_wav.write_bytes(cached.read_bytes())
    return out_wav
