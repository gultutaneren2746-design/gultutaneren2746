"""Senaryo (JSON) → seslendirme → zaman çizelgesi → ses tasarımı → 3D render → MP4."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path

import numpy as np

from . import audio as A
from . import textproc as TP
from . import tts

ROOT = Path(__file__).resolve().parent.parent
DEFAULTS = {
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "renderScale": 0.6667,   # 3D katman 720x1280'de çizilip 1080x1920'ye ölçeklenir (yazılar tam çözünürlükte)
    "lead": 0.2,             # ilk sözden önce boşluk
    "gap": 0.2,              # sahneler arası nefes
    "tail": 1.6,             # son sözden sonra
    "theme": {"accent": "#FFD400", "accent2": "#FF3B5C"},
}


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def _resolve_at(spec, scene_rel_words, default):
    if spec is None:
        return default
    if isinstance(spec, (int, float)):
        return float(spec)
    if isinstance(spec, str) and spec.startswith("word:"):
        i = int(spec.split(":")[1])
        if scene_rel_words:
            return scene_rel_words[max(0, min(i, len(scene_rel_words) - 1))]["s"]
    if spec == "start":
        return 0.0
    return default


def build_timeline(script: dict, workdir: Path) -> tuple[dict, list[Path]]:
    cfg = {**DEFAULTS, **script.get("render", {})}
    voice_cfg = script.get("voice", {})
    scenes = script["scenes"]
    wavs, durs = [], []
    log(f"seslendirme ({tts.engine_name()}) – {len(scenes)} sahne")
    for i, sc in enumerate(scenes):
        say = TP.speakable(sc.get("say") or sc["text"])
        p = tts.synthesize(say, workdir / "voice" / f"s{i:02d}.wav", voice_cfg)
        wavs.append(p)
        durs.append(len(A.read_wav(str(p))) / A.SR)

    t = cfg["lead"]
    voice_starts = []
    for i, sc in enumerate(scenes):
        voice_starts.append(t)
        t += durs[i] + sc.get("pause_after", cfg["gap"])
    duration = voice_starts[-1] + durs[-1] + cfg["tail"]

    tl_scenes, words_all, events = [], [], []
    for i, sc in enumerate(scenes):
        start = 0.0 if i == 0 else voice_starts[i] - 0.12
        end = duration if i == len(scenes) - 1 else voice_starts[i + 1] - 0.12
        toks = TP.tokenize(sc["text"])
        extra = set(w.lower() for w in sc.get("emphasis", []))
        weights = TP.word_weights(toks)
        tot = sum(weights)
        v0, v1 = voice_starts[i], voice_starts[i] + durs[i]
        acc = 0.0
        rel = []
        for (w, emph), wt in zip(toks, weights):
            ws = v0 + (v1 - v0) * acc / tot
            acc += wt
            item = {"t": TP.display(w), "raw": w, "s": round(ws, 3), "emph": bool(emph or TP.display(w).lower() in extra), "scene": i}
            words_all.append(item)
            rel.append({**item, "s": ws - start})
        ov = dict(sc.get("overlay") or {})
        if ov:
            first_emph = next((w["s"] for w in rel if w["emph"]), None)
            default_at = (first_emph - 0.05) if first_emph is not None else 0.25
            ov["at"] = round(max(0.0, _resolve_at(ov.get("at"), rel, default_at)), 3)
        tl_scenes.append({"start": round(start, 3), "end": round(end, 3), "visual": sc["visual"], "overlay": ov or None})

        # ---- otomatik ses tasarımı olayları
        if i > 0:
            if i == len(scenes) - 1 and script.get("final_riser", True):
                events.append({"t": start, "type": "riser"})
                events.append({"t": start + 0.02, "type": "impact", "shake": 10})
            else:
                events.append({"t": start, "type": "whoosh"})
        if ov:
            ot = start + ov["at"]
            if ov.get("count"):
                cd = ov["count"].get("dur", 1.4)
                events.append({"t": ot, "type": "impact", "shake": 18})
                for k in np.arange(0.0, cd * 0.9, 0.07):
                    events.append({"t": round(ot + k, 3), "type": "tick"})
                events.append({"t": ot + cd, "type": "ding"})
            elif ov.get("temp"):
                events.append({"t": ot, "type": "glitch"})
                for k in np.arange(0.3, (end - start) * 0.7, 0.09):
                    events.append({"t": round(start + k, 3), "type": "tick"})
            elif ov.get("big"):
                events.append({"t": ot, "type": "impact", "shake": 16})
            elif ov.get("sub"):
                events.append({"t": ot, "type": "pop"})
        if i == 0 and not ov:
            events.append({"t": voice_starts[0], "type": "impact", "shake": 14})
        for w in rel:
            if w["emph"]:
                events.append({"t": round(start + w["s"], 3), "type": "pop"})
        for e in sc.get("sfx", []):
            et = start + _resolve_at(e.get("at"), rel, 0.0)
            events.append({"t": round(et, 3), "type": e["type"], **({"shake": e["shake"]} if "shake" in e else {})})

    # aynı türden çok yakın olayları ayıkla
    events.sort(key=lambda e: e["t"])
    dedup, last = [], {}
    for e in events:
        if e["t"] - last.get(e["type"], -9) >= (0.05 if e["type"] == "tick" else 0.25):
            dedup.append(e)
            last[e["type"]] = e["t"]

    chunks = []
    for i in range(len(scenes)):
        sw = [w for w in words_all if w["scene"] == i]
        for ch in TP.chunk_words(sw, script.get("caption_words", 3)):
            chunks.append({"s": ch[0]["s"], "words": [{"t": w["t"], "s": w["s"], "emph": w["emph"]} for w in ch]})
    for k, c in enumerate(chunks):
        nxt = chunks[k + 1]["s"] if k + 1 < len(chunks) else duration
        last_w = c["words"][-1]["s"]
        c["e"] = round(min(nxt, last_w + 1.2), 3)

    tl = {
        "id": script["id"],
        "fps": cfg["fps"], "width": cfg["width"], "height": cfg["height"], "renderScale": cfg["renderScale"],
        "duration": round(duration, 3),
        "title": script.get("title"),
        "theme": {**DEFAULTS["theme"], **script.get("theme", {})},
        "captionY": script.get("caption_y", 0.7),
        "scenes": tl_scenes,
        "captions": chunks,
        "events": dedup,
        "voice": [{"t": round(voice_starts[i], 3), "dur": round(durs[i], 3)} for i in range(len(scenes))],
    }
    return tl, wavs


def build_audio(script: dict, tl: dict, wavs: list[Path], out: Path):
    log("ses tasarımı: müzik + efekt sentezi")
    seed = int(script.get("seed", abs(hash(script["id"])) % 10000))
    rng = np.random.default_rng(seed)
    n = int((tl["duration"] + 0.5) * A.SR)
    voice = np.zeros(n)
    for v, w in zip(tl["voice"], wavs):
        x = A.read_wav(str(w))
        i = int(v["t"] * A.SR)
        voice[i:i + len(x)] += x[: n - i]
    scenes = tl["scenes"]
    breaks = [(s["start"], s["end"]) for s, sc in zip(scenes, script["scenes"]) if sc.get("break")]
    if script.get("final_break", True):
        breaks.append((scenes[-1]["start"], tl["duration"] + 1))
    bed = A.music(tl["duration"], mood=script.get("mood", "mystery"), seed=seed,
                  drums_from=scenes[1]["start"] if len(scenes) > 1 else 3.0, breaks=breaks, ambience=script.get("ambience"))
    sfx = np.zeros((n, 2))
    cache = {}
    for e in tl["events"]:
        typ = e["type"]
        if typ not in A.SFX:
            continue
        key = (typ, len(cache) % 3) if typ in ("whoosh", "pop") else typ
        if key not in cache:
            cache[key] = A.SFX[typ](rng)
        clip = cache[key]
        t = e["t"] - (len(clip) / A.SR if typ in A.SFX_ALIGN_END else A.SFX_PRE.get(typ, 0.0))
        A.place(sfx, clip, t, A.db(A.SFX_GAIN[typ]))
    mix = A.mixdown(voice, bed, sfx, duck_db=script.get("duck_db", -11))
    A.write_wav(str(out), mix)
    return out


def write_srt(tl: dict, path: Path):
    def ts(x):
        h, r = divmod(x, 3600); m, s = divmod(r, 60)
        return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int((s % 1) * 1000):03d}"
    lines = []
    for k, c in enumerate(tl["captions"], 1):
        lines += [str(k), f"{ts(c['s'])} --> {ts(c['e'])}", " ".join(w["t"] for w in c["words"]), ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def write_meta(script: dict, tl: dict, path: Path):
    post = script.get("post", {})
    tags = " ".join("#" + h.lstrip("#") for h in post.get("hashtags", []))
    txt = [
        f"BAŞLIK: {post.get('title') or (script.get('title') or '').replace(chr(10), ' ')}",
        "",
        "AÇIKLAMA:",
        post.get("caption", ""),
        "",
        tags,
        "",
        f"Süre: {tl['duration']:.1f} sn  |  Seslendirme: {tts.engine_name()}",
        "",
        "KAYNAKLAR (paylaşmadan önce doğrulayın):",
        *[f"- {s}" for s in script.get("sources", [])],
    ]
    path.write_text("\n".join(txt), encoding="utf-8")


def build(script_path: str | Path, out_root: str | Path = ROOT / "output", workers: int | None = None,
          preview: float | None = None, keep: bool = False) -> Path:
    script_path = Path(script_path)
    script = json.loads(script_path.read_text(encoding="utf-8"))
    out_dir = Path(out_root) / script["id"]
    work = out_dir / "work"
    work.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    tl, wavs = build_timeline(script, work)
    tl_path = work / "timeline.json"
    tl_path.write_text(json.dumps(tl, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"zaman çizelgesi: {tl['duration']:.1f} sn, {len(tl['scenes'])} sahne, {len(tl['captions'])} altyazı parçası, {len(tl['events'])} ses olayı")

    mix = build_audio(script, tl, wavs, work / "mix.wav")

    log("3D render başlıyor")
    video = work / "video.mp4"
    workers = workers or max(1, min(4, (os.cpu_count() or 2) // 2))
    cmd = ["node", str(ROOT / "renderer" / "render.mjs"), str(tl_path), str(video), "--workers", str(workers)]
    if preview:
        cmd += ["--preview", str(preview)]
    subprocess.run(cmd, check=True)

    final = out_dir / f"{script['id']}.mp4"
    log("montaj + loudness (-14 LUFS)")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video), "-i", str(mix),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", str(final)], check=True)
    write_srt(tl, out_dir / f"{script['id']}.srt")
    write_meta(script, tl, out_dir / "paylasim.txt")
    thumb_t = tl["scenes"][0]["start"] + (tl["scenes"][0].get("overlay") or {}).get("at", 0.5) + 1.6
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{min(thumb_t, tl['duration'] - 0.5):.2f}", "-i", str(final),
                    "-frames:v", "1", "-q:v", "2", str(out_dir / "kapak.jpg")], check=True)
    if not keep:
        shutil.rmtree(work / "voice", ignore_errors=True)
    log(f"bitti: {final}  ({time.time() - t0:.0f} sn)")
    return final
