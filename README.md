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

### Seslendirme seçimi
| Ortam değişkeni | Motor |
|---|---|
| `GOOGLE_TTS_API_KEY` tanımlı | Google Cloud Text-to-Speech (varsayılan ses `tr-TR-Wavenet-B`) |
| tanımlı değil | Google Translate TTS (gTTS ile aynı ses, anahtar gerekmez) |

Ses, senaryoda `"voice": {"voice": "tr-TR-Wavenet-E", "cloud_rate": 1.1}` ile değiştirilebilir.

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

**3D şablonlar:** `mountains`, `school`, `bars`, `classroom`, `thermometer`, `snowroad`, `globe`, `question`
(parametreler: `factory/scriptgen.py` → `VISUAL_DOC`; kod: `renderer/engine.js` → `T.*`).
Yeni şablon eklemek için `engine.js` içine `T.yeni = (p, dur) => ({scene, cam, update(lt){...}})` yazmanız yeterli.

**Ses efektleri** (`factory/audio.py`): `whoosh`, `impact`, `riser`, `pop`, `tick`, `ding`, `swell`, `glitch`.
Geçiş, sayaç, vurgu ve kapanış efektleri otomatik yerleştirilir; `sfx` ile ek efekt verilebilir.

## Yapı

```
factory/      Python hattı: tts.py, audio.py (sentez), textproc.py, build.py, scriptgen.py (Claude)
renderer/     engine.js (three.js sahneleri + altyazı/geçiş kompoziti), render.mjs, stills.mjs
content/      scripts/*.json senaryolar, queue.txt konu kuyruğu, done.txt
```

> ⚠️ Otomatik üretilen her videonun `paylasim.txt` dosyasındaki kaynakları paylaşmadan önce kontrol edin.
