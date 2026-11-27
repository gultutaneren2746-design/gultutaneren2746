# Kitap Scraper (Scrapling)

`books.toscrape.com` deneme sitesindeki 1000 kitabın başlık, fiyat, puan ve stok bilgisini toplayıp CSV'ye yazar.

```bash
pip install "scrapling[fetchers]"
python scrape_books.py              # tüm sayfalar -> kitaplar.csv
python scrape_books.py --pages 3    # ilk 3 sayfa
```
