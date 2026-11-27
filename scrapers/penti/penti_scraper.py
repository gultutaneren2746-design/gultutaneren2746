"""Penti ürün ve fiyat toplayıcı (Scrapling).

Kullanım:
    python penti_scraper.py                          # varsayılan kategoriler
    python penti_scraper.py -k sutyen pijama-takimi  # belirli kategoriler
    python penti_scraper.py --max-sayfa 2            # kategori başına en fazla 2 sayfa
    python penti_scraper.py --onceki eski.csv        # fiyatı düşenleri raporla

Notlar:
- robots.txt'e uyar: sadece /tr/c/<kategori>?page=N sayfalarını okur
  (?q= filtreleri, arama, /paging/ ve /ajax/ kullanılmaz).
- İstekler arasında bekler (--bekle, varsayılan 1.5 sn).
"""

import argparse
import csv
import json
import time
from datetime import date

from scrapling.fetchers import Fetcher

BASE = "https://www.penti.com"
VARSAYILAN_KATEGORILER = ["sutyen", "kulot", "pijama-takimi", "kadin-corap", "kulotlu-corap"]
ALANLAR = ["kod", "ad", "kategori", "fiyat", "eski_fiyat", "indirim_yuzde",
           "kampanya", "url", "gorsel", "tarih"]


def fiyat(x):
    try:
        return round(float(x), 2)
    except (TypeError, ValueError):
        return None


def urunleri_ayikla(page, kategori):
    urunler = []
    for kart in page.css("div.prd.js-product-item-counter"):
        link = kart.css("a.prd-link")
        if not link:
            continue
        try:
            d = json.loads(link[0].attrib.get("data-gtm-product", "{}"))
        except json.JSONDecodeError:
            continue
        guncel, eski = fiyat(d.get("price")), fiyat(d.get("dimension16"))
        indirim = round((1 - guncel / eski) * 100) if guncel and eski and eski > guncel else 0
        urunler.append({
            "kod": kart.attrib.get("data-prd-code") or d.get("dimension14"),
            "ad": d.get("name", "").strip(),
            "kategori": kategori,
            "fiyat": guncel,
            "eski_fiyat": eski,
            "indirim_yuzde": indirim,
            "kampanya": (d.get("dimension23") or "").strip(),
            "url": BASE + link[0].attrib.get("href", ""),
            "gorsel": d.get("dimension19", ""),
            "tarih": date.today().isoformat(),
        })
    return urunler


def sayfa_getir(url, deneme=4, bekle=1.5):
    """Hata/yönlendirme (hız sınırı) olursa artan beklemeyle tekrar dener."""
    for i in range(deneme):
        try:
            page = Fetcher.get(url, follow_redirects=False, retries=1)
            if page.status == 200:
                return page
            sebep = f"HTTP {page.status}"
        except Exception as e:  # bağlantı / yönlendirme hataları
            sebep = str(e)[:80]
        bekleme = bekle * (4 ** (i + 1))
        print(f"  {url}: {sebep} -> {bekleme:.0f} sn bekleyip tekrar deniyorum")
        time.sleep(bekleme)
    return None


def kategori_tara(kategori, max_sayfa, bekle):
    sonuc, gorulen, sayfa = [], set(), 0
    while max_sayfa is None or sayfa < max_sayfa:
        url = f"{BASE}/tr/c/{kategori}" + (f"?page={sayfa}" if sayfa else "")
        page = sayfa_getir(url, bekle=bekle)
        if page is None:
            print(f"  {url} alınamadı, bu kategoriyi burada bırakıyorum")
            break
        yeni = [u for u in urunleri_ayikla(page, kategori) if u["kod"] not in gorulen]
        if not yeni:
            break
        gorulen.update(u["kod"] for u in yeni)
        sonuc.extend(yeni)
        print(f"  {kategori} sayfa {sayfa}: {len(yeni)} ürün (toplam {len(sonuc)})")
        sayfa += 1
        time.sleep(bekle)
    return sonuc


def fiyat_dususleri(yeni, onceki_dosya):
    with open(onceki_dosya, encoding="utf-8-sig") as f:
        eski = {r["kod"]: fiyat(r["fiyat"]) for r in csv.DictReader(f)}
    dusenler = []
    for u in yeni:
        e = eski.get(u["kod"])
        if e and u["fiyat"] and u["fiyat"] < e:
            dusenler.append((u, e))
    dusenler.sort(key=lambda t: t[0]["fiyat"] / t[1])
    print(f"\n=== Fiyatı düşen {len(dusenler)} ürün ===")
    for u, e in dusenler[:30]:
        print(f"  {u['ad']}: {e:.2f} TL -> {u['fiyat']:.2f} TL  {u['url']}")
    return dusenler


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-k", "--kategoriler", nargs="+", default=VARSAYILAN_KATEGORILER)
    ap.add_argument("--max-sayfa", type=int, default=None)
    ap.add_argument("--bekle", type=float, default=1.5)
    ap.add_argument("--out", default=f"penti_{date.today().isoformat()}.csv")
    ap.add_argument("--onceki", help="Karşılaştırma için önceki CSV")
    args = ap.parse_args()

    tum, gorulen = [], set()
    for k in args.kategoriler:
        print(f"Kategori: {k}")
        for u in kategori_tara(k, args.max_sayfa, args.bekle):
            if u["kod"] not in gorulen:
                gorulen.add(u["kod"])
                tum.append(u)

    with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=ALANLAR)
        w.writeheader()
        w.writerows(tum)
    print(f"\n{len(tum)} ürün '{args.out}' dosyasına kaydedildi.")

    if args.onceki:
        fiyat_dususleri(tum, args.onceki)


if __name__ == "__main__":
    main()
