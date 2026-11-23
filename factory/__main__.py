"""Komut satırı.

  python -m factory build content/scripts/<id>.json   # senaryodan video üret
  python -m factory new "konu"                         # Claude ile araştır + senaryo yaz
  python -m factory auto --count 2                     # kuyruktaki sıradaki konulardan video üret
  python -m factory stills content/scripts/<id>.json   # sahne başına önizleme kareleri
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUEUE = ROOT / "content" / "queue.txt"
DONE = ROOT / "content" / "done.txt"


def cmd_build(a):
    from .build import build
    for s in a.scripts:
        build(s, out_root=a.out, workers=a.workers, preview=a.preview, keep=a.keep)


def cmd_new(a):
    from .scriptgen import generate
    p = generate(a.topic)
    print(p)
    if a.build:
        from .build import build
        build(p, out_root=a.out, workers=a.workers)


def cmd_auto(a):
    from .build import build
    from .scriptgen import generate
    done = set(DONE.read_text(encoding="utf-8").splitlines()) if DONE.exists() else set()
    topics = [t.strip() for t in QUEUE.read_text(encoding="utf-8").splitlines() if t.strip() and not t.startswith("#")]
    todo = [t for t in topics if t not in done][: a.count]
    if not todo:
        print("kuyrukta yeni konu yok – content/queue.txt dosyasına ekleyin")
        return
    for topic in todo:
        print(f"==> {topic}")
        try:
            p = generate(topic)
            build(p, out_root=a.out, workers=a.workers)
            with DONE.open("a", encoding="utf-8") as f:
                f.write(topic + "\n")
        except Exception as e:  # bir konu patlarsa diğerlerine devam et
            print(f"HATA ({topic}): {e}", file=sys.stderr)


def cmd_stills(a):
    from .build import build_timeline
    script = json.loads(Path(a.script).read_text(encoding="utf-8"))
    work = Path(a.out) / script["id"] / "work"
    work.mkdir(parents=True, exist_ok=True)
    tl, _ = build_timeline(script, work)
    tlp = work / "timeline.json"
    tlp.write_text(json.dumps(tl, ensure_ascii=False), encoding="utf-8")
    subprocess.run(["node", str(ROOT / "renderer" / "stills.mjs"), str(tlp), str(Path(a.out) / script["id"] / "stills"), "--at", str(a.at)], check=True)


def main():
    ap = argparse.ArgumentParser(prog="factory")
    ap.add_argument("--out", default=str(ROOT / "output"))
    ap.add_argument("--workers", type=int, default=None)
    sub = ap.add_subparsers(required=True)
    b = sub.add_parser("build"); b.add_argument("scripts", nargs="+"); b.add_argument("--preview", type=float); b.add_argument("--keep", action="store_true"); b.set_defaults(f=cmd_build)
    n = sub.add_parser("new"); n.add_argument("topic"); n.add_argument("--build", action="store_true"); n.set_defaults(f=cmd_new)
    au = sub.add_parser("auto"); au.add_argument("--count", type=int, default=1); au.set_defaults(f=cmd_auto)
    st = sub.add_parser("stills"); st.add_argument("script"); st.add_argument("--at", type=float, default=0.6); st.set_defaults(f=cmd_stills)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
