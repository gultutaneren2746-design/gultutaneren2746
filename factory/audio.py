"""Kodla ses tasarımı: tüm müzik ve efektler numpy/scipy ile sıfırdan sentezlenir.

Hazır ses dosyası kullanılmaz. Her video kendi tohum (seed) değeriyle farklı ama
tutarlı bir müzik altlığı ve efekt seti üretir.
"""
from __future__ import annotations

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000


# ------------------------------------------------------------------ temel DSP
def tarr(dur: float) -> np.ndarray:
    return np.arange(int(round(dur * SR))) / SR


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


def _sos(kind: str, f, order: int = 2):
    nyq = SR / 2
    if isinstance(f, (tuple, list)):
        wn = [max(10, min(nyq * 0.98, x)) / nyq for x in f]
    else:
        wn = max(10, min(nyq * 0.98, f)) / nyq
    return signal.butter(order, wn, btype=kind, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_sos("lowpass", f, order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("highpass", f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("bandpass", (lo, hi), order), x, axis=0)


def sweep(x: np.ndarray, f_curve: np.ndarray, kind="bandpass", width=0.6, block=256) -> np.ndarray:
    """Zamanla değişen filtre (bloklar halinde, durum taşınarak)."""
    y = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = float(f_curve[min(i, len(f_curve) - 1)])
        if kind == "bandpass":
            sos = _sos("bandpass", (f * (1 - width / 2), f * (1 + width / 2)), 2)
        elif kind == "lowpass":
            sos = _sos("lowpass", f, 2)
        else:
            sos = _sos("highpass", f, 2)
        if zi is None:
            zi = np.zeros((sos.shape[0], 2))
        y[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return y


def white(n, rng):
    return rng.standard_normal(n)


def pink(n, rng):
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, rng.standard_normal(n)) * 3.5


def saw(freq, t, phase=0.0):
    ph = np.cumsum(np.broadcast_to(freq, t.shape) / SR) + phase if np.ndim(freq) else freq * t + phase
    return 2.0 * (ph % 1.0) - 1.0


def env_ad(n, attack, decay_tau):
    t = np.arange(n) / SR
    e = np.exp(-np.maximum(0, t - attack) / decay_tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] = np.linspace(0, 1, a)
    return e


def env_asr(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    if a:
        e[:a] = np.linspace(0, 1, a) ** 1.5
    if r:
        e[-r:] *= np.linspace(1, 0, r) ** 1.5
    return e


def pan(mono, p):
    """p: -1 (sol) .. +1 (sağ), skaler veya dizi; eşit güç."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def stereo(mono):
    return np.stack([mono, mono], axis=1)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def db(x):
    return 10 ** (x / 20)


_IR_CACHE = {}


def reverb(x: np.ndarray, decay=1.6, wet=0.25, seed=1, damp=6000) -> np.ndarray:
    """Sentetik dürtü yanıtıyla (üstel sönümlü gürültü) konvolüsyon reverb."""
    key = (decay, seed, damp)
    if key not in _IR_CACHE:
        rng = np.random.default_rng(seed)
        n = int(decay * SR)
        t = np.arange(n) / SR
        envl = np.exp(-t * 6.9 / decay)
        ir = np.stack([white(n, rng) * envl, white(n, rng) * envl], axis=1)
        ir = lp(ir, damp)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
        _IR_CACHE[key] = ir / np.sqrt(np.sum(ir ** 2, axis=0))
    ir = _IR_CACHE[key]
    if x.ndim == 1:
        x = stereo(x)
    w = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], axis=1)
    return x * (1 - wet) + w * wet * 2.2


def place(buf: np.ndarray, clip: np.ndarray, t: float, gain=1.0):
    """clip'i buf içine t saniyesine ekle (stereo)."""
    if clip.ndim == 1:
        clip = stereo(clip)
    i = int(round(t * SR))
    if i < 0:
        clip = clip[-i:]
        i = 0
    j = min(len(buf), i + len(clip))
    if j > i:
        buf[i:j] += clip[: j - i] * gain


# ------------------------------------------------------------------ EFEKTLER
def sfx_whoosh(dur=0.7, rng=None, direction=1):
    rng = rng or np.random.default_rng(0)
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    x = pink(n, rng)
    fc = 250 * (18 ** (u ** 1.3))  # 250 Hz → ~4.5 kHz
    y = sweep(x, fc, "bandpass", width=0.9)
    shape = np.sin(np.pi * np.clip(u / 0.75, 0, 1) ** 1.2) ** 2
    shape[u > 0.75] *= np.exp(-(u[u > 0.75] - 0.75) * 30)
    y = norm(y * shape, 0.9)
    # ton katmanı: kısa aşağı süzülen sinüs, "whip" hissi
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(900 * (1 - 0.7 * u)) / SR) * shape * 0.08
    return pan(y + tone, direction * np.linspace(-0.8, 0.8, n))


def sfx_impact(dur=1.8, rng=None, low=1.0):
    rng = rng or np.random.default_rng(1)
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 38 + 95 * np.exp(-t * 18)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45) * low
    click = lp(white(n, rng), 3500) * np.exp(-t / 0.012) * 0.9
    body = lp(white(n, rng), 420) * np.exp(-t / 0.18) * 1.4
    tail = bp(pink(n, rng), 80, 900) * np.exp(-t / 0.6) * 0.35
    y = np.tanh((sub * 1.3 + click + body + tail) * 1.6)
    return reverb(norm(y, 0.95), decay=2.2, wet=0.22, seed=3)


def sfx_riser(dur=2.0, rng=None):
    rng = rng or np.random.default_rng(2)
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    nz = sweep(white(n, rng), 300 * (20 ** u), "bandpass", width=1.0)
    t = np.arange(n) / SR
    f = 180 * (4 ** (u ** 2))
    tone = sum(saw(f * d, t, ph) for d, ph in ((1.0, 0), (1.007, 0.3), (0.993, 0.6))) / 3
    tone = lp(tone, 2500)
    e = u ** 2.4
    e[-int(0.02 * SR):] *= np.linspace(1, 0, int(0.02 * SR))
    y = norm(nz, 0.7) + norm(tone, 0.35)
    return reverb(y * e, decay=1.5, wet=0.3, seed=5)


def sfx_pop(rng=None, pitch=1.0):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = (520 + 900 * np.exp(-t * 60)) * pitch
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    return stereo(y * 0.8)


def sfx_tick(pitch=1.0):
    n = int(0.03 * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * 2400 * pitch * t) * np.exp(-t / 0.005)
    return stereo(y * 0.5)


def sfx_ding(rng=None, base=1318.5):
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    idx = 3.0 * np.exp(-t / 0.15)
    y = np.sin(2 * np.pi * base * t + idx * np.sin(2 * np.pi * base * 3.5 * t)) * np.exp(-t / 0.5)
    y += 0.4 * np.sin(2 * np.pi * base * 2 * t) * np.exp(-t / 0.25)
    return reverb(norm(y, 0.6), decay=1.8, wet=0.35, seed=7)


def sfx_swell(dur=1.2, rng=None):
    rng = rng or np.random.default_rng(4)
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = hp(white(n, rng), 1500) * np.exp(-t / 0.35)
    y = lp(y, 9000)[::-1]
    return reverb(norm(y, 0.6), decay=1.2, wet=0.3)


def sfx_glitch(rng=None):
    rng = rng or np.random.default_rng(9)
    n = int(0.25 * SR)
    y = np.zeros(n)
    for _ in range(6):
        i = rng.integers(0, n - 2000)
        L = rng.integers(400, 2000)
        f = rng.uniform(200, 3000)
        y[i:i + L] += np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * rng.uniform(0.2, 0.5)
    return stereo(lp(y, 6000) * env_asr(n, 0.002, 0.03))


SFX = {
    "whoosh": lambda rng: sfx_whoosh(rng=rng, direction=rng.choice([-1, 1])),
    "impact": lambda rng: sfx_impact(rng=rng),
    "riser": lambda rng: sfx_riser(rng=rng),
    "pop": lambda rng: sfx_pop(rng=rng, pitch=rng.uniform(0.9, 1.15)),
    "tick": lambda rng: sfx_tick(pitch=rng.uniform(0.95, 1.05)),
    "ding": lambda rng: sfx_ding(rng=rng),
    "swell": lambda rng: sfx_swell(rng=rng),
    "glitch": lambda rng: sfx_glitch(rng=rng),
}
SFX_GAIN = {"whoosh": -9, "impact": -5, "riser": -10, "pop": -17, "tick": -24, "ding": -14, "swell": -12, "glitch": -16}
# riser ve swell olay zamanında BİTER (zirve), diğerleri olay zamanında başlar
SFX_ALIGN_END = {"riser", "swell"}
SFX_PRE = {"whoosh": 0.45}


# ------------------------------------------------------------------ MÜZİK
MOODS = {
    # kök (midi) + akor dizisi (kök'e göre yarım ton aralıkları)
    "mystery": {"bpm": 96, "root": 57, "prog": [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]]},  # Am F C G
    "epic": {"bpm": 100, "root": 50, "prog": [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]]},     # Dm C Bb A
    "uplift": {"bpm": 110, "root": 55, "prog": [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]]},  # G D Em C
    "tension": {"bpm": 90, "root": 52, "prog": [[0, 3, 7], [1, 4, 8], [0, 3, 7], [-2, 1, 5]]},
}


def _kick(rng):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 35)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.13)
    y += lp(white(n, rng), 2000) * np.exp(-t / 0.004) * 0.4
    return np.tanh(y * 1.5)


def _hat(rng, open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    return hp(white(n, rng), 7000) * np.exp(-t / (0.06 if open_ else 0.012)) * 0.5


def _snap(rng):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    y = bp(white(n, rng), 1200, 5000) * np.exp(-t / 0.05)
    y += np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.5
    return y


def music(duration: float, mood="mystery", seed=0, drums_from=4.0, breaks=(), ambience=None) -> np.ndarray:
    """Basit ama dolgun bir altlık: pad + bas + arpej + davul + (isteğe bağlı) rüzgâr."""
    rng = np.random.default_rng(seed)
    cfg = MOODS.get(mood, MOODS["mystery"])
    bpm, root, prog = cfg["bpm"], cfg["root"], cfg["prog"]
    beat = 60 / bpm
    bar = beat * 4
    n = int((duration + 2) * SR)
    pad = np.zeros((n, 2))
    bass = np.zeros(n)
    arp = np.zeros(n)
    drums = np.zeros(n)
    nbars = int(np.ceil(duration / bar)) + 1

    def in_break(t):
        return any(a <= t < b for a, b in breaks)

    for b in range(nbars):
        t0 = b * bar
        chord = prog[b % len(prog)]
        # PAD: her akor notası için iki detune testere + alt oktav
        seg = int((bar + 1.2) * SR)
        tt = np.arange(seg) / SR
        voice = np.zeros((seg, 2))
        for k, iv in enumerate(chord + [chord[0] + 12]):
            f = midi(root + iv)
            l = saw(f * 1.004, tt, rng.random()) + saw(f * 0.996, tt, rng.random())
            r = saw(f * 1.006, tt, rng.random()) + saw(f * 0.994, tt, rng.random())
            voice += np.stack([l, r], axis=1) * 0.12
        voice = lp(voice, 1100 + 500 * np.sin(b * 0.7) ** 2, order=2)
        voice *= env_asr(seg, 0.6, 1.1)[:, None]
        place(pad, voice, t0)
        # BAS: sekizlik nabız, kök notası
        bf = midi(root - 24 + chord[0])
        for k in range(8):
            ts = t0 + k * beat / 2
            if ts >= duration or ts < drums_from - bar or in_break(ts):
                continue
            m = int(beat / 2 * SR)
            tb = np.arange(m) / SR
            note = (np.sin(2 * np.pi * bf * tb) + 0.3 * lp(saw(bf, tb), 400)) * env_ad(m, 0.004, 0.16)
            place_m = int(ts * SR)
            bass[place_m:place_m + m] += note[: max(0, min(m, n - place_m))] * (0.9 if k % 2 == 0 else 0.6)
        # ARPEJ: 16'lık, akor tonları yukarı-aşağı
        pattern = [0, 1, 2, 3, 2, 1, 0, 2]
        tones = [root + 12 + iv for iv in chord] + [root + 24 + chord[0]]
        for k in range(16):
            ts = t0 + k * beat / 4
            if ts >= duration or ts < drums_from * 0.5:
                continue
            f = midi(tones[pattern[k % 8]])
            m = int(0.28 * SR)
            tb = np.arange(m) / SR
            note = lp(saw(f, tb) * 0.6 + np.sin(2 * np.pi * f * tb), 2600) * env_ad(m, 0.002, 0.09)
            i = int(ts * SR)
            arp[i:i + m] += note[: max(0, min(m, n - i))] * (1.0 if k % 4 == 0 else 0.65)
        # DAVUL
        for k in range(16):
            ts = t0 + k * beat / 4
            if ts < drums_from or ts >= duration or in_break(ts):
                continue
            i = int(ts * SR)
            if k in (0, 8) or (k == 10 and b % 2):
                c = _kick(rng); drums[i:i + len(c)] += c[: max(0, min(len(c), n - i))]
            if k in (4, 12):
                c = _snap(rng) * 0.55; drums[i:i + len(c)] += c[: max(0, min(len(c), n - i))]
            if k % 2 == 1:
                c = _hat(rng, open_=(k == 15)) * (0.6 if k % 4 == 3 else 0.35); drums[i:i + len(c)] += c[: max(0, min(len(c), n - i))]

    # arpej için ping-pong eko
    d = int(beat * 0.75 * SR)
    arp_st = stereo(arp)
    echo = np.zeros_like(arp_st)
    for k, g in enumerate((0.38, 0.22, 0.12), start=1):
        sh = np.roll(arp, d * k) * g
        sh[: d * k] = 0
        echo[:, k % 2] += sh
    arp_st = lp(arp_st + echo, 5000)

    mix = pad * db(-6) + stereo(lp(bass, 220)) * db(-5) + arp_st * db(-14) + reverb(stereo(drums), 0.8, 0.12, seed=11) * db(-9)
    mix = reverb(mix, decay=2.4, wet=0.18, seed=13)
    if ambience == "wind":
        nz = pink(n, rng)
        lfo = 500 + 350 * np.sin(2 * np.pi * np.arange(n) / SR / 7.0) + 150 * np.sin(2 * np.pi * np.arange(n) / SR / 2.3)
        wind = sweep(nz, lfo, "bandpass", width=0.8, block=1024)
        gust = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(n) / SR / 5.3) ** 2
        mix += pan(norm(wind * gust, 0.5), 0.4 * np.sin(np.arange(n) / SR / 3)) * db(-8)
    mix = mix[: int(duration * SR)]
    fade = int(1.5 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix[: int(0.3 * SR)] *= np.linspace(0, 1, int(0.3 * SR))[:, None]
    return norm(mix, 0.7)


# ------------------------------------------------------------------ MİKS
def envelope(x: np.ndarray, attack=0.01, release=0.25) -> np.ndarray:
    a = np.abs(x)
    hop = 240
    m = a[: len(a) // hop * hop].reshape(-1, hop).max(axis=1)
    out = np.zeros_like(m)
    ga, gr = np.exp(-hop / SR / attack), np.exp(-hop / SR / release)
    v = 0.0
    for i, s in enumerate(m):
        g = ga if s > v else gr
        v = g * v + (1 - g) * s
        out[i] = v
    e = np.repeat(out, hop)
    return np.pad(e, (0, len(x) - len(e)), mode="edge")


def mixdown(voice: np.ndarray, music_bed: np.ndarray, sfx_bus: np.ndarray, duck_db=-11.0) -> np.ndarray:
    n = max(len(voice), len(music_bed), len(sfx_bus))
    v = np.zeros(n); v[: len(voice)] = voice
    m = np.zeros((n, 2)); m[: len(music_bed)] = music_bed
    s = np.zeros((n, 2)); s[: len(sfx_bus)] = sfx_bus
    env = envelope(v)
    k = np.clip(env / (np.percentile(env[env > 1e-4], 60) + 1e-9 if np.any(env > 1e-4) else 1), 0, 1)
    duck = db(duck_db * k)
    out = (stereo(v) * db(-1) + m * db(-12) * duck[:, None] + s * db(-2)) * db(-5)
    # yalnızca tepe noktalarına dokunan yumuşak limiter (eşik 0.8); son loudness ffmpeg loudnorm ile
    a = np.abs(out)
    knee = 0.8
    over = a > knee
    out[over] = np.sign(out[over]) * (knee + (1 - knee) * np.tanh((a[over] - knee) / (1 - knee)))
    return out


def write_wav(path: str, x: np.ndarray):
    x = np.clip(x, -1, 1)
    wavfile.write(path, SR, (x * 32767).astype(np.int16))


def read_wav(path: str) -> np.ndarray:
    sr, x = wavfile.read(path)
    assert sr == SR, f"{path}: {sr} Hz (beklenen {SR})"
    x = x.astype(np.float32) / (32768 if x.dtype == np.int16 else 1)
    return x if x.ndim == 1 else x.mean(axis=1)
