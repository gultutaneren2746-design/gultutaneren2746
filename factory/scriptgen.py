"""Konu → araştırma (web araması) → viral Shorts senaryosu (JSON).

Claude API kullanır (ANTHROPIC_API_KEY veya `ant auth login`).
1. adım: Claude web_search ile konuyu araştırır, doğrulanmış gerçekleri + kaynakları çıkarır.
2. adım: Bu gerçeklerden, render motorunun anladığı şemada 55-65 sn'lik senaryo yazar (structured output).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Literal, Optional

import anthropic
from pydantic import BaseModel, Field

MODEL = "claude-opus-5-5"
ROOT = Path(__file__).resolve().parent.parent

VISUAL_DOC = """
Kullanılabilir 3D sahne şablonları (visual.type) ve parametreleri:
- mountains: karlı dağlar üzerinde uçuş ya da işaretçi etrafında yörünge. params: pin {label, sub} (yer işaretçisi), snowfall (bool), time ("day"|"dusk"), snowCover (0-1).
- school: dağ platosunda okul binası, dalgalanan Türk bayrağı, baca dumanı, kar. params: sign (tabela yazısı, BÜYÜK HARF), students (0-4 küçük figür), time ("day"|"night"), label.
- bars: 3D kıyas sütunları. params: unit (ör. " m", " km", " °C", "%"), items [{label ("\\n" ile 2 satır olabilir), value (sayı), highlight (bool)}] (2-5 öğe), stagger (sütunlar arası sn).
- classroom: köy sınıfı iç mekânı; sıralar, öğrenciler, öğretmen, soba, kara tahta. params: students (1-4), board (tahtaya yazı, "\\n" ile 2 satır).
- thermometer: sıcaklık düşüşü/yükselişi animasyonu, buz kristalleri. params: from, to (°C), min, max.
- snowroad: karla kapanmış yol, yolu açan iş makinesi, arkasından yürüyen kişi. params: label.
- globe: dünya küresi, enlem/boylam pinleri, iki pin arasında yay. params: pins [{lat, lon, label}] (1-2 adet).
- question: dönen 3D soru işareti (kanca veya kapanış/CTA için). params: color.
- lake: göl üzerinde drone uçuşu ya da işaretçi etrafında yörünge. params: pin {label, sub}, waterColor, color ("pink" pembe su), salt (bool, tuz kabuğu – Tuz Gölü), time ("day"|"dusk"), snow (bool).
- depth: göl/deniz/boğaz derinlik kesiti; sonda en dibe iner. params: value (en derin nokta, m), refs [{label, value}] (kıyas: ör. Eyfel Kulesi 330), label. Overlay {live: {suffix: " m"}} ile derinlik sayacı.
- peak: tek büyük zirve (bulut halkası, tırmanış rotası, zirvede bayrak). params: height (zirve m), base (sayaç başlangıç m), label, twin (ikinci küçük zirve, varsayılan true), climber (bool), flag (bool). Overlay {live: {suffix: " m"}} ile irtifa sayacı.
- tunnel: tünel içinde hızlı sürüş, sonda çıkış ışığı. params: length_km, color (ışık rengi). Overlay {live: {suffix: " km", decimals: 1}} ile mesafe sayacı.
- underground: yer altı şehri kesiti (katlar, döner taş kapılar, merdivenler, insanlar); kamera aşağı iner. params: levels, depth (m), people (kat başına), surface ("cappadocia"|"plain"). Overlay {live: {suffix: " m"}}.
- crowd: insan figürleri spiral şeklinde çoğalır, kamera yükselir; etrafta köy evleri. params: people (figür ≤600), count (sayaç hedefi), snow. Overlay {live: {}} + sub ile nüfus sayacı.
- ruins: antik tapınak (Göbeklitepe tipi T-dikilitaşlar, kabartmalar, toz). params: label, sub, pillars, time ("dusk"|"day").
- timeline: zamanda geriye yolculuk; yıllara göre ışıklı işaretler. params: marks [{label, year (MÖ için negatif), highlight}], now. Overlay {live: {era: true}} ile yıl sayacı (MÖ ...).
- quake: deprem; şehir sallanır, fay kayar, ekranda sismograf çizilir. params: magnitude, city ("dense"|"sparse"). Overlay {live: {decimals: 1}, sub: "büyüklük"}.
Overlay (isteğe bağlı, sahnenin üst kısmında büyük yazı): {big: "kısa metin"} veya {count: {from, to, suffix, prefix, dur}} (sayaç), {temp: true} (termometre değeri), {live: {suffix, prefix, decimals, era}} (sahnenin kendi canlı değeri: depth/peak/tunnel/underground/crowd/timeline/quake/thermometer), {sub: "küçük etiket"}, y (0-1 dikey konum, başlıkla çakışmasın: ilk sahnede 0.34, diğerlerinde 0.17).
"""

SYSTEM = f"""Sen Türkçe kısa video (YouTube Shorts, Instagram Reels, TikTok) senaristisin. Merak uyandıran, viral bilgi videoları yazarsın.

Kurallar:
- Toplam seslendirme 130-160 kelime (≈55-65 sn). 7-10 sahne. Her sahne 1-2 kısa cümle.
- İlk 2 saniye KANCA: şaşırtıcı bir sayı ya da çelişki. Asla "Merhaba", "Bugün size" ile başlama.
- Sonda soru sorup yoruma ve takibe çağır.
- Sadece verilen araştırma notlarındaki doğrulanmış bilgileri kullan. Emin olmadığın iddiayı yumuşat ("biri", "yaklaşık", "olabilir"). Asla uydurma rakam yazma.
- Sayıları rakamla yaz (2.400, -30, %15); binlik ayırıcı nokta. Vurgulanacak 1-3 kelimeyi *yıldız* içine al (ör. *2.400 metre*).
- Dil: sade, konuşma dili, kısa cümleler, Türkçe karakterler doğru. Seslendirme insan gibi aksın: soru cümleleri, ünlemler, "peki", "ama", "üstelik" gibi bağlaçlar kullan; uzun yan cümlelerden kaçın.
- Her sahneye isteğe bağlı "tone" yaz (ör. "gizemli ve fısıltıya yakın", "şaşkın ve heyecanlı", "sakin ve duygusal", "meydan okuyan"); Gemini-TTS anlatıcısı bunu uygular.
- title: ekranın üstünde ilk sahnede görünen 2 satırlık merak başlığı ("\\n" ile böl), en fazla ~30 karakter.
- id: Türkçe karakter içermeyen kebab-case.
{VISUAL_DOC}
Görselleri anlatımla eşleştir; aynı şablonu üst üste kullanma; son sahne genelde question."""


class Pin(BaseModel):
    label: str
    sub: Optional[str] = None


class BarItem(BaseModel):
    label: str
    value: float
    highlight: bool = False


class GlobePin(BaseModel):
    lat: float
    lon: float
    label: str


class RefItem(BaseModel):
    label: str
    value: float


class Mark(BaseModel):
    label: str
    year: int
    highlight: bool = False


class Visual(BaseModel):
    type: Literal["mountains", "school", "bars", "classroom", "thermometer", "snowroad", "globe", "question",
                  "lake", "depth", "peak", "tunnel", "underground", "crowd", "ruins", "timeline", "quake"]
    pin: Optional[Pin] = None
    snowfall: Optional[bool] = None
    time: Optional[Literal["day", "dusk", "night"]] = None
    sign: Optional[str] = None
    students: Optional[int] = None
    label: Optional[str] = None
    unit: Optional[str] = None
    items: Optional[list[BarItem]] = None
    board: Optional[str] = None
    from_: Optional[float] = Field(default=None, alias="from")
    to: Optional[float] = None
    pins: Optional[list[GlobePin]] = None
    sub: Optional[str] = None
    color: Optional[str] = None
    waterColor: Optional[str] = None
    salt: Optional[bool] = None
    snow: Optional[bool] = None
    value: Optional[float] = None
    refs: Optional[list[RefItem]] = None
    height: Optional[float] = None
    base: Optional[float] = None
    twin: Optional[bool] = None
    climber: Optional[bool] = None
    flag: Optional[bool] = None
    length_km: Optional[float] = None
    levels: Optional[int] = None
    depth: Optional[float] = None
    people: Optional[int] = None
    count: Optional[int] = None
    surface: Optional[Literal["cappadocia", "plain"]] = None
    pillars: Optional[int] = None
    marks: Optional[list[Mark]] = None
    now: Optional[int] = None
    magnitude: Optional[float] = None
    city: Optional[Literal["dense", "sparse"]] = None


class Count(BaseModel):
    from_: float = Field(default=0, alias="from")
    to: float
    suffix: Optional[str] = None
    prefix: Optional[str] = None


class Live(BaseModel):
    suffix: Optional[str] = None
    prefix: Optional[str] = None
    decimals: Optional[int] = None
    era: Optional[bool] = None


class Overlay(BaseModel):
    big: Optional[str] = None
    count: Optional[Count] = None
    temp: Optional[bool] = None
    live: Optional[Live] = None
    sub: Optional[str] = None
    y: Optional[float] = None


class Scene(BaseModel):
    text: str
    tone: Optional[str] = None
    visual: Visual
    overlay: Optional[Overlay] = None


class Post(BaseModel):
    title: str
    caption: str
    hashtags: list[str]


class Script(BaseModel):
    id: str
    title: str
    mood: Literal["mystery", "epic", "uplift", "tension"]
    ambience: Optional[Literal["wind"]] = None
    scenes: list[Scene]
    post: Post
    sources: list[str]


def research(client: anthropic.Anthropic, topic: str) -> str:
    """Web araması ile gerçekleri ve kaynakları topla."""
    with client.beta.messages.stream(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "high"},
        tools=[{"type": "web_search_20260209", "name": "web_search", "max_uses": 8}],
        system="Türkçe kısa bilgi videosu için araştırmacısın. Gerçekleri web'de doğrula; her gerçeğin yanına kaynak URL yaz. "
               "Doğrulanamayanları 'DOĞRULANAMADI' diye işaretle. Şaşırtıcı sayılar, kıyaslar ve somut detaylar bul.",
        messages=[{"role": "user", "content": f"Konu: {topic}\n\nBu konu için 8-15 maddelik doğrulanmış gerçek listesi ve kaynakları çıkar. "
                                               "Konudaki iddia tam doğru değilse en doğru ifadeyi öner."}],
    ) as stream:
        msg = stream.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError("araştırma isteği reddedildi")
    return "\n".join(b.text for b in msg.content if b.type == "text")


def write_script(client: anthropic.Anthropic, topic: str, notes: str) -> dict:
    resp = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        output_config={"effort": "high"},
        system=SYSTEM,
        messages=[{"role": "user", "content": f"Konu: {topic}\n\nAraştırma notları:\n{notes}\n\nBu konuda senaryoyu yaz."}],
        output_format=Script,
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("senaryo isteği reddedildi")
    data = resp.parsed_output.model_dump(by_alias=True, exclude_none=True)
    data["id"] = re.sub(r"[^a-z0-9-]+", "-", data["id"].lower()).strip("-") or "video"
    return data


def generate(topic: str, out_dir: Path = ROOT / "content" / "scripts") -> Path:
    client = anthropic.Anthropic()
    notes = research(client, topic)
    script = write_script(client, topic, notes)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{script['id']}.json"
    path.write_text(json.dumps(script, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / f"{script['id']}.research.md").write_text(f"# {topic}\n\n{notes}\n", encoding="utf-8")
    return path
