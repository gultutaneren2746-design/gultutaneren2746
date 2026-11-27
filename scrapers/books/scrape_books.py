"""books.toscrape.com kitap verisi toplayıcı (Scrapling).

Kullanım:
    python scrape_books.py                 # tüm sayfalar
    python scrape_books.py --pages 3       # ilk 3 sayfa
    python scrape_books.py --out kitaplar.csv
"""

import argparse
import csv
import time
from urllib.parse import urljoin

from scrapling.fetchers import Fetcher

BASE = "https://books.toscrape.com/"
RATINGS = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5}


def parse_page(page, page_url):
    books = []
    for card in page.css("article.product_pod"):
        link = card.css("h3 a")[0]
        rating_class = card.css("p.star-rating")[0].attrib.get("class", "")
        rating_word = rating_class.replace("star-rating", "").strip()
        price_text = card.css("p.price_color::text").get() or ""
        stock_text = " ".join(card.css("p.instock.availability::text").getall()).strip()
        books.append(
            {
                "baslik": link.attrib.get("title", "").strip(),
                "fiyat_gbp": float(price_text.replace("£", "").replace("Â", "").strip() or 0),
                "puan": RATINGS.get(rating_word, 0),
                "stok": stock_text,
                "url": urljoin(page_url, link.attrib.get("href", "")),
            }
        )
    next_link = page.css("li.next a")
    next_url = urljoin(page_url, next_link[0].attrib["href"]) if next_link else None
    return books, next_url


def scrape(max_pages=None, delay=0.5):
    url, all_books, n = BASE, [], 0
    while url and (max_pages is None or n < max_pages):
        page = Fetcher.get(url)
        if page.status != 200:
            print(f"Hata: {url} -> HTTP {page.status}")
            break
        books, url = parse_page(page, page.url)
        all_books.extend(books)
        n += 1
        print(f"Sayfa {n}: {len(books)} kitap (toplam {len(all_books)})")
        time.sleep(delay)  # siteyi yormamak için
    return all_books


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=None)
    ap.add_argument("--out", default="kitaplar.csv")
    args = ap.parse_args()

    books = scrape(args.pages)
    with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["baslik", "fiyat_gbp", "puan", "stok", "url"])
        w.writeheader()
        w.writerows(books)
    print(f"\n{len(books)} kitap '{args.out}' dosyasına kaydedildi.")


if __name__ == "__main__":
    main()
