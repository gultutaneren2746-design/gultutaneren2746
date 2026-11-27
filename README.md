# Shorts Factory 🎬

Merak uyandıran **Türkçe bilgi videolarını** (YouTube Shorts · Instagram Reels · TikTok) sürekli üreten sistem.

- **3D animasyon** – three.js sahneleri headless Chromium'da kare kare render edilir (1080×1920, 30 fps)
- **Seslendirme** – Google TTS (Cloud TTS anahtarı varsa WaveNet/Neural2, yoksa anahtarsız Google sesi)
- **Ses tasarımı tamamen kodla sentezlenir** – müzik altlığı (pad, bas, arpej, davul), rüzgâr ambiyansı,
  geçiş whoosh'ları, impact/boom, riser, sayaç tikleri, ding, pop; seslendirme altında otomatik ducking, −14 LUFS
- **Kelime kelime animasyonlu altyazı** (vurgulu kelimeler kırmızı kutuda) + `.srt` dosyası
- **Otomatik senaryo** – Claude web'de araştırır, kaynaklı gerçeklerden 55-65 sn'lik senaryo yazar
- **Sürekli üretim** – konu kuyruğu + GitHub Actions ile her gün otomatik video

## Hızlı başlangıç

```bash
pip install -r requirements.txt
npm install
npm install --no-save playwright && npx playwright install chromium   # (Chromium yoksa)
# ffmpeg kurulu olmalı

# Hazır senaryodan video üret
python -m factory build content/scripts/turkiyenin-en-yuksek-okulu.json
# → output/turkiyenin-en-yuksek-okulu/{turkiyenin-en-yuksek-okulu.mp4, .srt, kapak.jpg, paylasim.txt}

# Hızlı önizleme: her sahneden bir kare
python -m factory stills content/scripts/turkiyenin-en-yuksek-okulu.json

# Yeni konu: araştır + senaryo yaz (+ istersen hemen üret)
export ANTHROPIC_API_KEY=...
python -m factory new "Türkiye'nin en soğuk yeri" --build

# Kuyruktan sıradaki N konuyu üret
python -m factory auto --count 3
```

### Seslendirme seçimi (insan sesine yakınlık)

| Ayar | Motor | Doğallık |
|---|---|---|
| `GOOGLE_TTS_API_KEY` yok | Google Translate sesi (anahtarsız, gTTS ile aynı) | ★★ |
| anahtar var (varsayılan) | **Chirp 3 HD** – `tr-TR-Chirp3-HD-Charon` | ★★★★★ |
| anahtar + `"voice": {"engine": "gemini"}` | **Gemini-TTS** – stil talimatıyla (heyecanlı, gizemli…) | ★★★★★ + oyunculuk |
| anahtar + `"voice": {"engine": "wavenet"}` | WaveNet | ★★★ |

```jsonc
"voice": {"voice": "tr-TR-Chirp3-HD-Charon", "cloud_rate": 1.08}          // Chirp 3 HD
"voice": {"engine": "gemini", "voice": "Charon", "style": "Enerjik belgesel anlatıcısı..."}  // Gemini-TTS
```

Sahne bazında `"tone": "şaşkın ve heyecanlı"` yazılırsa Gemini-TTS o sahneyi o tonda okur.
Hangi sesin hoşunuza gittiğini seçmek için: `python -m factory voices [--gemini]`
→ `output/ses-ornekleri/` altına her Türkçe sesle örnek cümle üretir.

Tüm motorlarda ses zinciri: formant korumalı hızlandırma (rubberband), de-esser, kompresör,
sıcaklık/anlaşılırlık EQ'su ve mikste hafif oda yankısı.

## Sürekli üretim (GitHub Actions)

`.github/workflows/daily-shorts.yml` her gün `content/queue.txt` içindeki sıradaki konuyu alır,
araştırır, senaryoyu yazar, videoyu üretir ve **Artifacts** olarak yükler (mp4 + srt + kapak + paylaşım metni).
Repo ayarlarında **Secrets → Actions** altına ekleyin:

- `ANTHROPIC_API_KEY` (zorunlu – senaryo üretimi)
- `GOOGLE_TTS_API_KEY` (isteğe bağlı – daha doğal ses)

Elle tetikleme: Actions → "Günlük Shorts üretimi" → *Run workflow* (adet veya doğrudan konu girilebilir).

## Senaryo formatı

```jsonc
{
  "id": "kebab-case-id",
  "title": "Ekranın üstünde\nmerak başlığı",
  "mood": "mystery",          // mystery | epic | uplift | tension  (müzik karakteri)
  "ambience": "wind",         // isteğe bağlı ortam sesi
  "scenes": [
    {
      "text": "Altyazı ve seslendirme. *Vurgulu kelimeler* yıldızla.",
      "say": "(isteğe bağlı) farklı okunuş",
      "visual": {"type": "mountains", "pin": {"label": "Akmazdam"}},
      "overlay": {"count": {"from": 0, "to": 2400, "suffix": " m"}, "sub": "rakım"},
      "sfx": [{"type": "impact", "at": "word:3"}]
    }
  ],
  "post": {"title": "...", "caption": "...", "hashtags": ["..."]},
  "sources": ["..."]
}
```

**3D şablonlar (17):**

| Şablon | Ne gösterir | Uygun konular |
|---|---|---|
| `mountains` | karlı dağlar, uçuş / işaretçi | rakım, bölge tanıtımı |
| `school` | okul binası, bayrak, kar | köy okulları |
| `bars` | 3D kıyas sütunları | her türlü sayı kıyası |
| `classroom` | sınıf içi, öğrenciler, soba | eğitim |
| `thermometer` | sıcaklık sayacı, buz | iklim, en soğuk/sıcak |
| `snowroad` | karlı yol, iş makinesi | ulaşım, kış |
| `globe` | dünya küresi, pinler, yay | dünya kıyasları |
| `question` | 3D soru işareti | kanca / kapanış |
| `lake` | göl uçuşu; pembe su, tuz kabuğu | Van Gölü, Tuz Gölü |
| `depth` | derinlik kesiti, inen sonda, kıyas silueti | göl/deniz/Boğaz derinliği |
| `peak` | tek zirve, bulutlar, tırmanış rotası, irtifa sayacı | Ağrı Dağı, zirveler |
| `tunnel` | tünelde sürüş, km sayacı, çıkış ışığı | en uzun tüneller |
| `underground` | yer altı şehri kesiti, döner taş kapılar | Kapadokya yer altı şehirleri |
| `crowd` | çoğalan kalabalık, nüfus sayacı | nüfus, kalabalık köy |
| `ruins` | T-dikilitaşlı antik tapınak | Göbeklitepe, antik yapılar |
| `timeline` | zamanda geri yolculuk, MÖ yıl sayacı | tarih kıyasları |
| `quake` | sallanan şehir, kayan fay, sismograf | depremler |

Sahnenin kendi canlı değerini (derinlik, irtifa, km, yıl, nüfus, büyüklük) üstte göstermek için
`"overlay": {"live": {"suffix": " m", "decimals": 1, "era": true}}` kullanılır.
Parametreler: `factory/scriptgen.py` → `VISUAL_DOC`; kod: `renderer/engine.js` ve `renderer/templates/extra.js`.
Yeni şablon eklemek için `renderer/templates/` altında `kit.T.yeni = (p, dur) => ({scene, cam, update(lt){...}})` yazıp `index.html`'den içe aktarmanız yeterli.

**Ses efektleri** (`factory/audio.py`): `whoosh`, `impact`, `riser`, `pop`, `tick`, `ding`, `swell`, `glitch`.
Geçiş, sayaç, vurgu ve kapanış efektleri otomatik yerleştirilir; `sfx` ile ek efekt verilebilir.

## Yapı

```
factory/      Python hattı: tts.py, audio.py (sentez), textproc.py, build.py, scriptgen.py (Claude)
renderer/     engine.js (three.js sahneleri + altyazı/geçiş kompoziti), render.mjs, stills.mjs
content/      scripts/*.json senaryolar, queue.txt konu kuyruğu, done.txt
```

> ⚠️ Otomatik üretilen her videonun `paylasim.txt` dosyasındaki kaynakları paylaşmadan önce kontrol edin.
