# PyroSense 🔥

**OWL 2 Ontoloji Tabanlı Orman Yangını Erken Uyarı Sistemi**

PyroSense; OWL 2 ontoloji ve SPARQL çıkarım motoru kullanan, Türkiye'nin 12 farklı orman bölgesini gerçek zamanlı olarak izleyen bir yangın riski tespit sistemidir. Fizik tabanlı bir Rust simülatörü sensör verisi üretir; TypeScript backend her okumayı ontoloji üzerinden işleyerek risk skoru hesaplar ve WebSocket aracılığıyla React arayüzüne iletir.

> **Durum:** Tam simülasyon modu — tüm sensör verisi fizik tabanlı Rust simülatörü tarafından üretilmektedir (danışman kararı 25.03.2026).

---

## İçindekiler

- [Mimari](#mimari)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Hızlı Başlangıç](#hızlı-başlangıç)
- [Sensör Bölgeleri](#sensör-bölgeleri)
- [Simülasyon Senaryoları](#simülasyon-senaryoları)
- [Risk Skoru Motoru](#risk-skoru-motoru)
- [Ontoloji ve Çıkarım Kuralları](#ontoloji-ve-çıkarım-kuralları)
- [Open-Meteo Hava Entegrasyonu](#open-meteo-hava-entegrasyonu)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Servis Adresleri](#servis-adresleri)
- [API Referansı](#api-referansı)

---

## Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                        Rust Simülatör  :8090                     │
│  Fizik Motoru (Gaussian gürültü + Weibull rüzgar + günlük döngü) │
│  EMA Filtresi (α=0.3) + WindWindow (10×30s kayan ortalama)       │
│  HTTP API :8090  →  POST /scenario  (bölge bazlı senaryo kontrol)│
└────────────────────────┬────────────────────────────────────────┘
                         │ MQTT  pyrosense/#
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Mosquitto Broker  :1883                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 TypeScript Backend  :3001 / :3002                 │
│                                                                  │
│  1. saveSensorReading()    → PostgreSQL / TimescaleDB            │
│  2. toRdfTurtle()          → RDF Turtle serileştirme             │
│  3. uploadTurtle()         → Apache Jena Fuseki  :3030           │
│  4. inferRiskFlags()       → SPARQL çıkarım (+ statik fallback)  │
│  5. getZoneDrought()       ← PostgreSQL kuraklık indeksi         │
│  6. calculateRisk()        → Toplamlı bayrak skorlaması (0-100)  │
│  7. evaluateAlarm()        → Histerezis (aç≥70, kapat<45)        │
│  8. saveRiskScore()        → PostgreSQL                          │
│  9. broadcast()            → WebSocket Gateway  :3002            │
│ 10. saveAlarm/closeAlarm() → PostgreSQL alarm durumu             │
│ 11. logAlarmEvent()        → MongoDB denetim izi                 │
└─────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
  PostgreSQL          MongoDB          WebSocket
  TimescaleDB         alarm_events     :3002
  :5434               :27017           (frontend)
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │  React Frontend :5173  │
                              │  Dashboard / Analitik  │
                              └───────────────────────┘
```

---

## Teknoloji Yığını

| Katman | Teknoloji | Amaç |
|---|---|---|
| Simülatör | **Rust** + Tokio + rumqttc + axum | Asenkron fizik tabanlı sensör simülasyonu |
| Mesaj Kuyruğu | **Mosquitto** (MQTT 3.1.1) | Simülatör → Backend mesaj taşıma |
| Ontoloji Motoru | **Apache Jena Fuseki** (OWL 2 + SPARQL) | Sensör triple'ları üzerinde semantik çıkarım |
| Backend | **Node.js / TypeScript** + ts-node | MQTT tüketici + risk pipeline |
| Zaman Serisi DB | **PostgreSQL + TimescaleDB** | Sensör okumaları, risk skorları, alarmlar |
| Doküman DB | **MongoDB** | Değiştirilemez alarm olay denetim izi |
| Hava API | **Open-Meteo** (ücretsiz, API anahtarsız) | 30 günlük gerçek yağış → kuraklık sınıfı |
| Gerçek Zamanlı İletim | **WebSocket** (ws kütüphanesi) | Canlı risk skoru aktarımı |
| Frontend | **React + TypeScript** (Vite) | Dashboard, harita, analitik, senaryo kontrolü |
| Yönetim Arayüzleri | Adminer :8082, Mongo Express :8081 | Veritabanı inceleme |

---

## Proje Yapısı

```
PyroSense/
├── simulator/                  # Rust sensör simülatörü
│   ├── src/
│   │   ├── main.rs             # Giriş noktası, bölge konfigürasyonu, ana döngü
│   │   ├── nodes.rs            # NodeConfig tanımları
│   │   ├── models/sensor.rs    # SensorReading, ForestType, Topology
│   │   ├── mqtt/               # MQTT publisher (rumqttc, QoS::AtMostOnce)
│   │   └── scenarios/mod.rs    # SensorPhysics, EmaFilter, WindWindow
│   └── Cargo.toml
│
├── backend/                    # TypeScript backend
│   └── src/
│       ├── index.ts            # Başlangıç: MQTT tüketici + WS gateway + hava verisi
│       ├── constants/          # Ortam değişkeni yükleyici
│       ├── types/sensor.ts     # SensorMessage tipi
│       └── services/
│           ├── mqttConsumer.ts      # 11 adımlı pipeline
│           ├── rdfConverter.ts      # JSON → RDF Turtle + NaN temizleme
│           ├── fusekiClient.ts      # Fuseki Admin API + SPARQL UPDATE ile ontoloji yükleme
│           ├── inferenceService.ts  # SPARQL çıkarım + statik fallback (RULE_META_STATIC)
│           ├── riskCalculator.ts    # Bayrak tabanlı toplamlı skorlama
│           ├── alarmManager.ts      # Histerezis + soğuma süresi durum makinesi
│           ├── weatherService.ts    # Open-Meteo fetch + kuraklık sınıflandırması
│           ├── weatherRepository.ts
│           ├── sensorRepository.ts
│           ├── riskRepository.ts
│           ├── alarmLogRepository.ts # MongoDB yazımı
│           ├── wsGateway.ts         # WebSocket yayın sunucusu
│           ├── httpServer.ts        # REST API :3001
│           ├── database.ts          # PostgreSQL bağlantısı
│           └── mongoClient.ts       # MongoDB lazy singleton
│
├── frontend/                   # React + TypeScript arayüzü
│   └── src/
│       ├── App.tsx             # Ana uygulama, WebSocket, sayfa yönlendirme
│       ├── types/              # RiskUpdate, AlarmEntry, SensorDataPoint tipleri
│       └── components/
│           ├── RiskCard.tsx         # Bölge başına risk kartı (sidebar)
│           ├── ZoneMap.tsx          # Türkiye haritası üzerinde bölge gösterimi
│           ├── AlarmList.tsx        # Aktif / geçmiş alarm listesi
│           ├── SensorChart.tsx      # Son 20 kayıt sensör grafikleri
│           ├── ScenarioControl.tsx  # Senaryo kontrol paneli
│           ├── WeatherWidget.tsx    # Hava durumu widgeti
│           ├── ReasoningLog.tsx     # OWL çıkarım adımları log'u
│           └── AnalyticsPage.tsx    # Doğrulama metrikleri (otomatik yenileme)
│
├── ontology/
│   ├── pyrosense-core.owl      # OWL 2 ontoloji (sınıflar, özellikler, bireyler)
│   └── pyrosense-rules.jrl     # 63+ Jena kural dili kuralı
│
├── config/
│   ├── mosquitto/mosquitto.conf
│   └── postgres/
│       ├── init.sql            # Şema + TimescaleDB hypertable + 12 bölge seed
│       └── migrate_12zones.sql
│
├── docker-compose.yml          # 6 altyapı servisi
├── .env                        # Ortam konfigürasyonu
└── README.md
```

---

## Hızlı Başlangıç

### Gereksinimler

- Docker ve Docker Compose
- Rust (stable, `cargo`)
- Node.js ≥ 18 + npm

### 1. Altyapıyı Başlat

```bash
docker compose up -d
```

6 servis başlar: Mosquitto, Fuseki, PostgreSQL/TimescaleDB, MongoDB, Mongo Express, Adminer.

> **Not:** Fuseki dataset'i (`pyrosense`) backend başladığında **otomatik olarak** oluşturulur ve ontoloji yüklenir. Manuel yapılandırma gerekmez.

### 2. Backend'i Başlat

```bash
cd backend
npm install
npm run dev
```

Backend başladığında şunları yapar:
- Fuseki'nin hazır olmasını bekler (max 60s)
- `pyrosense` dataset'ini write erişimiyle yeniden oluşturur
- `ontology/pyrosense-core.owl` dosyasını SPARQL UPDATE ile yükler (365 triple)
- MQTT broker'a bağlanır, `pyrosense/#` kanalına abone olur
- Open-Meteo'dan hava verisi çeker (başlangıçta + her saat)
- WebSocket gateway'i :3002 portunda başlatır
- REST API'yi :3001 portunda başlatır

### 3. Simülatörü Başlat

```bash
cd simulator
cargo run
```

12 bölge için her 30 saniyede bir sensör okuması yayınlar.

### 4. Frontend'i Başlat

```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

---

## Sensör Bölgeleri

12 farklı Türkiye orman tipi için birer sensör düğümü:

| Bölge ID | Ad | Orman Tipi | Topografya | Koordinatlar |
|---|---|---|---|---|
| zone_redpine | Kızılçam — Muğla/Menteşe | Kızılçam | Yamaç | 37.22°N, 28.36°E |
| zone_blackpine | Karaçam — Kastamonu | Karaçam | Sırt | 41.38°N, 33.77°E |
| zone_scotspine | Sarıçam — Sarıkamış/Kars | Sarıçam | Sırt | 40.33°N, 42.59°E |
| zone_tauruscedar | Toros Sediri — Toros Dağları | Toros Sediri | Yamaç | 37.10°N, 34.60°E |
| zone_silverfir | Göknar — Bolu/Abant | Göknar | Yamaç | 40.74°N, 31.60°E |
| zone_orientalspruce | Doğu Ladini — Rize/Artvin | Doğu Ladini | Yamaç | 41.05°N, 40.50°E |
| zone_oak | Meşe — Kızılcahamam/Ankara | Meşe | Vadi | 40.47°N, 32.66°E |
| zone_orientalbeech | Doğu Kayını — Karabük/Yenice | Doğu Kayını | Yamaç | 41.20°N, 32.60°E |
| zone_alder | Kızılağaç — Göksu Deltası/Mersin | Kızılağaç | Vadi | 36.30°N, 33.98°E |
| zone_shrubland | Maki — Antalya Kıyısı | Maki | Yamaç | 36.88°N, 30.71°E |
| zone_juniper | Ardıç — Beyşehir/Konya | Ardıç | Ova | 37.68°N, 31.73°E |
| zone_mixed | Karma — Belgrad Ormanı/İstanbul | Karma | Vadi | 41.19°N, 28.95°E |

Her sensör okuması şu alanları içerir: `temperature` (°C), `humidity` (%), `smoke_ppm`, `uv_index`, `wind_speed_ms`, `wind_dir_deg`, `flame_detected`, `co2_ppm`.

### Sinyal İşleme

Ham okumalar yayınlanmadan önce iki filtreden geçer:

- **EMA Filtresi** (α = 0.3) — sıcaklık ve neme uygulanır. Senaryo değişimlerinde ani sıçramaları önler, sensör termal ataleti simüle eder.
- **WindWindow** (10 örnek × 30s = 5 dk) — rüzgar hızı için kayan ortalama. Yangın yayılım modellerinde kullanılan RAWS (Uzak Otomatik Hava İstasyonu) standart sürekli rüzgar ölçümüne uygun.

---

## Simülasyon Senaryoları

Senaryolar bölge bazında HTTP API ile değiştirilir:

| Senaryo | Temel Özellikler |
|---|---|
| `normal` | Günlük sıcaklık döngüsü, düşük duman (~5 ppm), Weibull rüzgar dağılımı |
| `prefire` | Duman 80–350 ppm, sıcaklık normal üstü +7°C, nem %8–25, rüzgar 4–15 m/s |
| `activefire` | `flame_detected=true`, duman 500–1000 ppm, sıcaklık 45–70°C, CO₂ ~2000 ppm |
| `sensorFault` | Rastgele geçersiz değerler (999.9°C, -%1 nem, null CO₂) — temizleme testi |

Normal senaryo; mevsimsel ofsetler (Temmuz/Ağustos en yüksek risk) ve ormana özgü baz sıcaklıklar (Doğu Ladini 12°C — Maki 28°C) kullanır.

---

## Risk Skoru Motoru

Risk hesabı `riskCalculator.ts` içinde **toplamlı bayrak sistemi** ile yapılır.

### Adım 1 — Kuraklık Çarpanı

Open-Meteo'dan alınan gerçek hava verisi eşik değerlerini dinamik olarak ayarlar:

| Kuraklık Sınıfı | 30 Günlük Yağış | Eşik Çarpanı |
|---|---|---|
| `ExtremeDrought` | < 10 mm | × 0.80 (eşikler düşer — risk artar) |
| `ModerateDrought` | 10–40 mm | × 0.90 |
| `NormalMoisture` | ≥ 40 mm | × 1.00 |

### Adım 2 — Bayrak Değerlendirmesi

| Bayrak | Koşul |
|---|---|
| `FLAME_DETECTED` | `flameDetected === true` |
| `HIGH_DROUGHT_RISK` | `sıcaklık > droughtTemp` VE `nem < droughtHum` |
| `SMOKE_ALARM` | `smokePpm > smokeAlarm` |
| `HIGH_SPREAD_RISK` | `rüzgar > spreadWind` VE `sıcaklık > spreadTemp` |
| `EARLY_FIRE_SIGNAL` | `co2 > earlySignalCo2` VE `duman > earlySignalSmoke` |
| `VALLEY_WIND_AMPLIFICATION` | Vadi topografyası VE `rüzgar > 6` VE `sıcaklık > 25` |
| `RIDGE_WIND_EXPOSURE` | Sırt topografyası VE `rüzgar > 8` |
| `SLOPE_FIRE_SPREAD_CRITICAL` | Yamaç topografyası VE `rüzgar > 5` VE `nem < 30` VE `sıcaklık > 30` |

### Adım 3 — Toplamlı Skorlama

```
skor = min(100, Σ ağırlıklar[bayrak])
```

| Bayrak | Ağırlık |
|---|---|
| FLAME_DETECTED | 65 |
| SMOKE_ALARM | 35 |
| SLOPE_FIRE_SPREAD_CRITICAL | 30 |
| EARLY_FIRE_SIGNAL | 25 |
| DOWNWIND_SPREAD_THREAT | 25 |
| HIGH_SPREAD_RISK | 20 |
| HIGH_DROUGHT_RISK | 20 |
| VALLEY_WIND_AMPLIFICATION | 15 |
| RIDGE_WIND_EXPOSURE | 10 |

### Adım 4 — Risk Seviyesi

| Skor | Seviye |
|---|---|
| 0–34 | LOW |
| 35–59 | MODERATE |
| 60–79 | HIGH |
| 80–100 | EXTREME |

### Alarm Durum Makinesi

- **Açılma:** skor ≥ 70 VE son kapanmadan bu yana 10 dakika geçmiş olmalı
- **Kapanma:** skor < 45
- `justOpened` ve `justClosed` olayları PostgreSQL durumunu + MongoDB denetim kaydını günceller

---

## Ontoloji ve Çıkarım Kuralları

### OWL 2 Çekirdeği (`pyrosense-core.owl`)

Sınıf hiyerarşisi ve özellikler:
- `SensorNode` — `forestType`, `topology`, GPS koordinatları
- `SensorReading` — sıcaklık, nem, duman, rüzgar, CO₂, alev özellikleri; `ssn:isObservedBy` ile `SensorNode`'a bağlı
- 12 orman tipi ve 3 topografya tipi için adlandırılmış bireyler
- Her kural için `pyro:ruleWeight` ve `pyro:ruleLabel` annotation özellikleri

Backend başladığında ontoloji **otomatik olarak** yüklenir:
1. Fuseki'nin ayağa kalkması beklenir (max 60s)
2. `pyrosense` dataset'i Admin API ile silip `dbType=mem` write erişimiyle yeniden oluşturulur
3. OWL dosyası SPARQL UPDATE ile `<http://pyrosense.io/ontology>` named graph'ına yüklenir
4. Yükleme başarısıyla 365 triple doğrulanır

### Jena Kural Dili (`pyrosense-rules.jrl`)

63+ kural; 12 orman tipi × 4 koşul kategorisi:
- `[ForestType_HighDroughtRisk]` — yüksek sıcaklık + düşük nem
- `[ForestType_SmokeAlarm]` — duman PPM eşiği
- `[ForestType_SpreadRisk]` — rüzgar hızı + sıcaklık kombinasyonu
- `[ForestType_EarlyFireSignal]` — CO₂ + duman erken uyarısı

Artı 3 topografya kuralı:
- `[Valley_WindAmplification]` — vadi kanalizasyon etkisi
- `[Ridge_WindExposure]` — açık sırt rüzgar riski
- `[Slope_FireSpreadCritical]` — yamaç + rüzgar + düşük nem + ısı

---

## Open-Meteo Hava Entegrasyonu

[Open-Meteo](https://open-meteo.com/) (API anahtarsız, ücretsiz) her bölgenin koordinatları için gerçek yağış verisi çeker. Son 30 günlük günlük yağış toplamı kuraklık koşulunu belirler; bu da risk eşiklerini gerçek zamanlı ayarlar.

Hava verisi başlangıçta çekilir ve her saat yenilenir. Sonuçlar `weather_cache` tablosuna ve `zones` tablosundaki `drought_index` sütununa kaydedilir.

---

## Veritabanı Şeması

### PostgreSQL (TimescaleDB) Tabloları

| Tablo | Tür | Açıklama |
|---|---|---|
| `sensor_readings` | hypertable | Ham sensör verisi, zaman indeksli |
| `risk_scores` | hypertable | Bölge başına hesaplanan risk skoru |
| `alarms` | normal tablo | OPEN/CLOSED yaşam döngüsüyle alarm durumu |
| `zones` | normal tablo | Bölge meta verisi + güncel kuraklık indeksi |
| `weather_cache` | normal tablo | Open-Meteo fetch geçmişi |

**alarms tablosu notları:**
- `acknowledged` — operatör onayı için hazır (henüz arayüzde aktif değil)
- `notified_email`, `notified_sms` — bildirim entegrasyonu için hazır alanlar

### MongoDB Koleksiyonu

| Koleksiyon | Açıklama |
|---|---|
| `alarm_events` | Değiştirilemez denetim izi — her OPENED ve CLOSED olayı tam bağlamıyla |

---

## Ortam Değişkenleri

`.env` dosyasını kopyalayıp düzenle. Tüm değişkenler backend tarafından gereklidir.

```env
# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_URL=mqtt://localhost:1883
PUBLISH_INTERVAL_SECS=30

# Apache Jena Fuseki
FUSEKI_URL=http://localhost:3030
FUSEKI_DATASET=pyrosense
FUSEKI_USER=admin
FUSEKI_PASSWORD=pyrosense123
ONTOLOGY_GRAPH=http://pyrosense.io/ontology

# PostgreSQL
DATABASE_URL=postgresql://pyrosense:pyrosense123@localhost:5434/pyrosense

# MongoDB
MONGO_URL=mongodb://pyrosense:pyrosense123@localhost:27017/pyrosense?authSource=admin

# Open-Meteo (API anahtarsız)
OPEN_METEO_URL=https://api.open-meteo.com/v1

# Backend
BACKEND_PORT=3001
WEBSOCKET_PORT=3002

# E-posta bildirimi (geliştirme modunda kapalı)
SMTP_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ALARM_EMAIL_TO=admin@pyrosense.local
```

---

## Servis Adresleri

| Servis | URL | Kimlik Bilgileri |
|---|---|---|
| React Frontend | http://localhost:5173 | — |
| Backend REST API | http://localhost:3001 | — |
| WebSocket Gateway | ws://localhost:3002 | — |
| Simülatör HTTP API | http://localhost:8090 | — |
| Apache Jena Fuseki | http://localhost:3030 | admin / pyrosense123 |
| Adminer (PostgreSQL) | http://localhost:8082 | server: `postgres`, user: `pyrosense`, pass: `pyrosense123` |
| Mongo Express | http://localhost:8081 | — (geliştirme modunda kimlik doğrulamasız) |
| Mosquitto (MQTT) | mqtt://localhost:1883 | — |

---

## API Referansı

Tam API dokümantasyonu için bkz: [docs/API.md](docs/API.md)

---

## Kalıcılık Stratejisi

PyroSense **çok modelli kalıcılık** kullanır:

- **PostgreSQL + TimescaleDB** — operasyonel durum. Alarm açık/kapalı durumu, zaman serisi sensör ve risk verileri. Zaman aralığı sorguları ve bölge tabanlı aramalar için optimize edilmiş.
- **MongoDB** — değiştirilemez denetim izi. Her alarm yaşam döngüsü olayı (`OPENED`, `CLOSED`) tam bağlamıyla (skor, seviye, bayraklar, zaman) ekleme-sonrası-güncellenmez belge olarak yazılır.

---

*PyroSense — Bitirme Tezi, 2026*
