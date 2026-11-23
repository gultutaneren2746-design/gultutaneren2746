"""Türkçe metin yardımcıları: sayıları okunuşa çevirme, hece sayma, altyazı parçalama."""
from __future__ import annotations

import re

ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"]
TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"]
VOWELS = set("aeıioöuüAEIİOÖUÜâîûÂÎÛ")


def _u1000(n: int) -> str:
    h, r = divmod(n, 100)
    out = []
    if h:
        out.append("yüz" if h == 1 else f"{ONES[h]} yüz")
    t, o = divmod(r, 10)
    if t:
        out.append(TENS[t])
    if o:
        out.append(ONES[o])
    return " ".join(out)


def int_to_tr(n: int) -> str:
    if n == 0:
        return "sıfır"
    if n < 0:
        return "eksi " + int_to_tr(-n)
    parts = []
    for size, name in ((10 ** 9, "milyar"), (10 ** 6, "milyon"), (1000, "bin")):
        q, n = divmod(n, size)
        if q:
            parts.append("bin" if (size == 1000 and q == 1) else f"{_u1000(q) if q < 1000 else int_to_tr(q)} {name}")
    if n:
        parts.append(_u1000(n))
    return " ".join(parts)


NUM_RE = re.compile(r"(?<![\w.,])(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?")


def number_words(m: re.Match) -> str:
    neg, whole, dec = m.group(1), m.group(2), m.group(3)
    s = int_to_tr(int(whole.replace(".", "")))
    if dec:
        s += " virgül " + " ".join(int_to_tr(int(d)) for d in dec) if dec.startswith("0") else f" virgül {int_to_tr(int(dec))}"
    return ("eksi " if neg else "") + s


def speakable(text: str) -> str:
    """Seslendirme için: işaretleri kaldır, birimleri ve sayıları yazıya çevir."""
    t = text.replace("*", "")
    t = re.sub(r"%\s?(\d)", r"yüzde \1", t)
    t = re.sub(r"(\d)\s?°C", r"\1 derece", t)
    t = re.sub(r"(\d)\s?°", r"\1 derece", t)
    t = re.sub(r"(\d)\s?km\b", r"\1 kilometre", t)
    t = re.sub(r"(\d)\s?m\b", r"\1 metre", t)
    t = NUM_RE.sub(number_words, t)
    return re.sub(r"\s+", " ", t).strip()


def syllables(word: str) -> float:
    w = speakable(word)
    n = sum(1 for c in w if c in VOWELS)
    return max(1.0, float(n))


def tokenize(text: str):
    """'*vurgulu*' işaretlerini koruyarak kelimelere böl. -> [(kelime, vurgu)]"""
    out, emph = [], False
    for raw in text.split():
        start = raw.startswith("*") or raw.lstrip("\"'(“").startswith("*")
        if start:
            emph = True
        end = raw.rstrip(".,!?;:…\"')”").endswith("*")
        w = raw.replace("*", "")
        if w:
            out.append((w, emph))
        if end:
            emph = False
    return out


def word_weights(words):
    ws = []
    for i, (w, _) in enumerate(words):
        wt = syllables(w)
        if i < len(words) - 1:
            if re.search(r"[.!?…]$", w):
                wt += 2.2
            elif re.search(r"[,;:]$", w):
                wt += 1.1
        ws.append(wt)
    return ws


def chunk_words(words, max_words=3, max_chars=16):
    """Kelime listesini ekranda birlikte görünecek küçük gruplara ayır."""
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        text_len = sum(len(x["t"]) for x in cur) + len(cur) - 1
        if len(cur) >= max_words or text_len >= max_chars or re.search(r"[.!?,;:…]$", w.get("raw", w["t"])):
            chunks.append(cur)
            cur = []
    if cur:
        if chunks and len(cur) == 1 and len(chunks[-1]) < max_words and sum(len(x["t"]) for x in chunks[-1]) + len(cur[0]["t"]) < max_chars + 4 \
                and not re.search(r"[.!?,;:]$", chunks[-1][-1].get("raw", chunks[-1][-1]["t"])):
            chunks[-1].extend(cur)
        else:
            chunks.append(cur)
    return chunks


def display(w: str) -> str:
    """Altyazıda virgül/nokta gösterme; ? ve ! kalsın."""
    return re.sub(r"[,.;:…]+$", "", w)
