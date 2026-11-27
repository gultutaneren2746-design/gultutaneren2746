# Sesli Sohbet Botu (Pipecat, Türkçe)

Tarayıcıdan mikrofonla konuştuğun, Türkçe cevap veren bir yapay zekâ asistanı.

```
Mikrofon → Deepgram (konuşma→metin, Türkçe) → Claude (cevap) → Cartesia (metin→ses, Türkçe) → Hoparlör
```

## Gereken API anahtarları (hepsinin ücretsiz deneme kredisi var)

| Servis | Ne işe yarar | Nereden alınır |
|---|---|---|
| Deepgram | Sesini yazıya çevirir | console.deepgram.com |
| Anthropic | Cevabı üretir (Claude) | console.anthropic.com |
| Cartesia | Cevabı sese çevirir | play.cartesia.ai |

## Çalıştırma (bilgisayarda)

```bash
cd server
cp .env.example .env        # anahtarları .env içine yaz
uv sync
uv run bot.py
```

Tarayıcıda **http://localhost:7860** adresini aç, "Connect"e bas ve konuşmaya başla.

## Özelleştirme (`server/bot.py`)

- **Kişilik / görev:** `system_instruction` metnini değiştir (ör. "Sen X Kuaför'ün randevu asistanısın...").
- **Ses:** Cartesia'dan Türkçe konuşabilen bir ses seçip ID'sini `.env` içindeki `CARTESIA_VOICE_ID`'ye yaz.
- **Model:** `ANTHROPIC_MODEL` (varsayılan `claude-haiku-5-5`, düşük gecikme için).

## Notlar

- `.env` dosyası `.gitignore`'da; anahtarlarını asla GitHub'a gönderme.
- Telefonda kullanmak için bot internete açık bir sunucuda (ör. Coolify kurulu VPS, HTTPS ile)
  ya da Pipecat Cloud'da (`pcc-deploy.toml`) çalışmalı; mikrofon izni için tarayıcı HTTPS ister.
- İngilizce orijinal kurulum notları: `README.md`.
