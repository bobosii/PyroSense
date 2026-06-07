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
│  Bölge bazlı hakim rüzgar yönü (prevailing_wind_dir ± varyans)   │
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
│  4. inferRiskFlags()       → SPARQL çıkarım (Q1–Q9)             │
│  5. getZoneDrought()       ← PostgreSQL kuraklık indeksi         │
│  6. calculateRisk()        → Toplamlı bayrak skorlaması (0-100)  │
│  7. evaluateAlarm()        → Histerezis (aç≥55, kapat<45)        │
│  8. saveRiskScore()        → PostgreSQL                          │
│  9. broadcast()            → WebSocket Gateway  :3002            │
│ 10. saveAlarm/closeAlarm() → PostgreSQL alarm durumu             │
│ 11. logAlarmEvent()        → PostgreSQL alarm_events denetim izi │
└─────────────────────────────────────────────────────────────────┘
         │                │
         ▼                ▼
  PostgreSQL          WebSocket
  TimescaleDB         :3002
  :5434               (frontend)
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
| Zaman Serisi DB | **PostgreSQL + TimescaleDB** | Sensör okumaları, risk skorları, alarmlar, denetim izi |
| Hava API | **Open-Meteo** (ücretsiz, API anahtarsız) | 30 günlük gerçek yağış → kuraklık sınıfı |
| Gerçek Zamanlı İletim | **WebSocket** (ws kütüphanesi) | Canlı risk skoru aktarımı |
| Frontend | **React + TypeScript** (Vite) | Dashboard, harita, analitik, senaryo kontrolü |
| Yönetim Arayüzü | Adminer :8082 | PostgreSQL inceleme |

---

## Proje Yapısı

```
PyroSense/
├── simulator/                  # Rust sensör simülatörü
│   ├── src/
│   │   ├── main.rs             # Giriş noktası, bölge konfigürasyonu, ana döngü
│   │   ├── nodes.rs            # NodeConfig tanımları (prevailing_wind_dir dahil)
│   │   ├── models/sensor.rs    # SensorReading, NodeConfig, ForestType, Topology
│   │   ├── mqtt/               # MQTT publisher (rumqttc, QoS::AtMostOnce)
│   │   └── scenarios/mod.rs    # SensorPhysics, EmaFilter, WindWindow, prevailing_wind_dir()
│   └── Cargo.toml
│
├── backend/                    # TypeScript backend
│   └── src/
│       ├── index.ts            # Başlangıç: MQTT tüketici + WS gateway + hava verisi
│       ├── constants/          # Ortam değişkeni yükleyici
│       ├── types/sensor.ts     # SensorMessage tipi
│       └── services/
│           ├── mqttConsumer.ts      # 11 adımlı pipeline
│           ├── rdfConverter.ts      # JSON → RDF Turtle (windDirDeg dahil ^^xsd:double)
│           ├── fusekiClient.ts      # Fuseki Admin API + SPARQL UPDATE ile ontoloji yükleme
│           ├── inferenceService.ts  # SPARQL çıkarım Q1–Q9 + statik fallback
│           ├── riskCalculator.ts    # Bayrak tabanlı toplamlı skorlama
│           ├── alarmManager.ts      # Histerezis + soğuma süresi durum makinesi
│           ├── weatherService.ts    # Open-Meteo fetch + kuraklık sınıflandırması
│           ├── weatherRepository.ts
│           ├── sensorRepository.ts
│           ├── riskRepository.ts
│           ├── alarmLogRepository.ts # PostgreSQL alarm_events yazımı
│           ├── wsGateway.ts         # WebSocket yayın sunucusu
│           ├── httpServer.ts        # REST API :3001
│           └── database.ts          # PostgreSQL bağlantısı
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
│           ├── HistoryPanel.tsx     # Tarihsel sensör verisi sorgu paneli
│           ├── AnalyticsPage.tsx    # Doğrulama metrikleri
│           └── SourcesPage.tsx      # Bilimsel kaynaklar sayfası
│
├── ontology/
│   ├── pyrosense-core.owl      # OWL 2 ontoloji (sınıflar, özellikler, bireyler, kural ağırlıkları)
│   └── pyrosense-rules.jrl     # 64 Jena kural dili kuralı
│
├── config/
│   ├── mosquitto/mosquitto.conf
│   └── postgres/
│       ├── init.sql            # Şema + TimescaleDB hypertable + 12 bölge seed
│       └── migrate_12zones.sql # Eski veritabanlarına geçiş scripti
│
├── docs/
│   └── API.md                  # Tam API referansı
│
├── docker-compose.yml          # 4 altyapı servisi (Mosquitto, Fuseki, PostgreSQL, Adminer)
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

4 servis başlar: Mosquitto, Fuseki, PostgreSQL/TimescaleDB, Adminer.

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
- `ontology/pyrosense-core.owl` dosyasını SPARQL UPDATE ile yükler
- MQTT broker'a bağlanır, `pyrosense/#` kanalına abone olur
- Open-Meteo'dan hava verisi çeker (başlangıçta + her saat)
- WebSocket gateway'i :3002 portunda başlatır
- REST API'yi :3001 portunda başlatır

### 3. Simülatörü Başlat

```bash
cd simulator
cargo run
```

12 bölge × 3 node = 36 düğüm için her 30 saniyede bir sensör okuması yayınlar. Her bölgenin hakim rüzgar yönü meteorolojik veriye dayalıdır.

### 4. Frontend'i Başlat

```bash
cd frontend
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

---

## Sensör Bölgeleri

12 farklı Türkiye orman tipi için birer izleme bölgesi:

| Bölge ID | Ad | Orman Tipi | Topografya | Hakim Rüzgar |
|---|---|---|---|---|
| zone_redpine | Kızılçam — Muğla/Menteşe | Kızılçam | Yamaç | Lodos GB 220° |
| zone_blackpine | Karaçam — Kastamonu | Karaçam | Sırt | Karadeniz K-KB 340° |
| zone_scotspine | Sarıçam — Sarıkamış/Kars | Sarıçam | Sırt | Sibirya KD 50° |
| zone_tauruscedar | Toros Sediri — Toros Dağları | Toros Sediri | Yamaç | Akdeniz G-GB 195° |
| zone_silverfir | Göknar — Bolu/Abant | Göknar | Yamaç | Karadeniz B-KB 290° |
| zone_orientalspruce | Doğu Ladini — Rize/Artvin | Doğu Ladini | Yamaç | Karadeniz KKD 20° |
| zone_oak | Meşe — Kızılcahamam/Ankara | Meşe | Vadi | İç Anadolu K-KB 330° |
| zone_orientalbeech | Doğu Kayını — Karabük/Yenice | Doğu Kayını | Yamaç | Batı Karadeniz K 355° |
| zone_alder | Kızılağaç — Göksu Deltası/Mersin | Kızılağaç | Vadi | Akdeniz meltemi G-GB 185° |
| zone_shrubland | Maki — Antalya Kıyısı | Maki | Yamaç | Lodos+Meltemi B-GB 240° |
| zone_juniper | Ardıç — Beyşehir/Konya | Ardıç | Ova | İç Anadolu K-KB 320° |
| zone_mixed | Karma — Belgrad Ormanı/İstanbul | Karma | Vadi | Poyraz KKD 25° |

Her sensör okuması şu alanları içerir: `temperature` (°C), `humidity` (%), `smoke_ppm`, `uv_index`, `wind_speed_ms`, `wind_dir_deg`, `flame_detected`, `co2_ppm`.

### Sinyal İşleme

Ham okumalar yayınlanmadan önce iki filtreden geçer:

- **EMA Filtresi** (α = 0.3) — sıcaklık ve neme uygulanır.
- **WindWindow** (10 örnek × 30s = 5 dk) — rüzgar hızı için kayan ortalama. RAWS standardı sürekli rüzgar ölçümüne uygun.

### Hakim Rüzgar Yönü Modeli

Her bölgenin `NodeConfig`'inde `prevailing_wind_dir` (hakim yön, 0-359°) ve `wind_dir_variance` (±std_dev derece) tanımlanmıştır. Rüzgar yönü bu parametrelerden Gauss gürültüsüyle üretilir:

```
wind_dir = prevailing_wind_dir + Gauss(0, variance)  mod 360
```

Bu sayede `SOUTH_WIND_SLOPE_HAZARD` kuralı yalnızca coğrafi olarak anlamlı bölgelerde (Muğla, Toros, Mersin, Antalya) tetiklenir.

---

## Simülasyon Senaryoları

Senaryolar bölge bazında HTTP API ile değiştirilir:

| Senaryo | Temel Özellikler |
|---|---|
| `normal` | Günlük sıcaklık döngüsü, düşük duman (~5 ppm), Weibull rüzgar dağılımı |
| `prefire` | Duman 80–350 ppm, sıcaklık normal üstü +7°C, nem %8–25, rüzgar 4–15 m/s |
| `activefire` | `flame_detected=true`, duman 500–1000 ppm, sıcaklık 45–70°C, CO₂ ~2000 ppm |
| `sensorFault` | Rastgele geçersiz değerler (999.9°C, -%1 nem, null CO₂) — temizleme testi |

---

## Risk Skoru Motoru

Risk hesabı `riskCalculator.ts` içinde **toplamlı bayrak sistemi** ile yapılır.

### Kuraklık Çarpanı

Open-Meteo'dan alınan gerçek hava verisi eşik değerlerini dinamik olarak ayarlar:

| Kuraklık Sınıfı | 30 Günlük Yağış | Eşik Çarpanı |
|---|---|---|
| `ExtremeDrought` | < 2 mm | × 0.80 (eşikler düşer — risk artar) |
| `ModerateDrought` | 2–10 mm | × 0.90 |
| `NormalMoisture` | ≥ 10 mm | × 1.00 |

### Bayraklar ve Ağırlıklar

| Bayrak | Ağırlık | Koşul Özeti |
|---|---|---|
| `FLAME_DETECTED` | 65 | Alev sensörü aktif sinyal |
| `SMOKE_ALARM` | 35 | Türe özgü duman eşiği aşıldı |
| `SLOPE_FIRE_SPREAD_CRITICAL` | 30 | Yamaç + rüzgar > 5 + nem < 30 + sıcaklık > 30 |
| `EARLY_FIRE_SIGNAL` | 25 | CO₂ + duman kombinasyonu |
| `DOWNWIND_SPREAD_THREAT` | 25 | Komşu bölgede aktif yangın + rüzgar altı konum |
| `HIGH_SPREAD_RISK` | 20 | Rüzgar + sıcaklık kombinasyonu |
| `HIGH_DROUGHT_RISK` | 20 | Türe özgü sıcaklık + nem eşiği |
| `VALLEY_WIND_AMPLIFICATION` | 15 | Vadi + rüzgar > 6 + sıcaklık > 25 |
| `SOUTH_WIND_SLOPE_HAZARD` | 15 | Yamaç + güney rüzgarı 135°–225° + rüzgar > 4 + sıcaklık > 25 |
| `RIDGE_WIND_EXPOSURE` | 10 | Sırt + rüzgar > 8 |

### Risk Seviyeleri

| Skor | Seviye |
|---|---|
| 0–34 | LOW |
| 35–59 | MODERATE |
| 60–79 | HIGH |
| 80–100 | EXTREME |

### Alarm Durum Makinesi

- **Açılma:** skor ≥ 55 VE son kapanmadan bu yana 10 dakika geçmiş olmalı
- **Kapanma:** skor < 45
- EXTREME (≥80) durumunda soğuma süresi bypass edilir
- `justOpened` ve `justClosed` olayları PostgreSQL `alarms` ve `alarm_events` tablolarına kaydedilir

---

## Ontoloji ve Çıkarım Kuralları

### OWL 2 Çekirdeği (`pyrosense-core.owl`)

- `SensorNode` — `forestType`, `topology`, GPS koordinatları
- `SensorReading` — sıcaklık, nem, duman, rüzgar, CO₂, alev özellikleri; `ssn:isObservedBy` ile bağlı
- 12 bölge için adlandırılmış bireyler (`Zone`)
- Her kural için `pyro:ruleWeight` ve `rdfs:label` annotation özellikleri

### SPARQL Çıkarım Sorguları (`inferenceService.ts`)

9 paralel SPARQL sorgusu (Q1–Q9), `Promise.all` ile eşzamanlı çalışır:

| Sorgu | Bayrak |
|---|---|
| Q1 | `FLAME_DETECTED` |
| Q2 | `HIGH_DROUGHT_RISK` |
| Q3 | `SMOKE_ALARM` |
| Q4 | `HIGH_SPREAD_RISK` |
| Q5 | `EARLY_FIRE_SIGNAL` |
| Q6 | `VALLEY_WIND_AMPLIFICATION` |
| Q7 | `RIDGE_WIND_EXPOSURE` |
| Q8 | `SLOPE_FIRE_SPREAD_CRITICAL` |
| Q9 | `SOUTH_WIND_SLOPE_HAZARD` |

Fuseki erişilemezse `RULE_META_STATIC` statik fallback devreye girer.

### Jena Kural Dili (`pyrosense-rules.jrl`)

64 kural; 12 orman tipi × 5 koşul kategorisi + 4 topografya kuralı:
- `[ForestType_HighDroughtRisk]` — yüksek sıcaklık + düşük nem
- `[ForestType_SmokeAlarm]` — duman PPM eşiği
- `[ForestType_SpreadRisk]` — rüzgar hızı + sıcaklık kombinasyonu
- `[ForestType_EarlyFireSignal]` — CO₂ + duman erken uyarısı
- `[ForestType_FlameDetected]` — alev sensörü teyidi
- `[Valley_WindAmplification]` — vadi kanalizasyon etkisi
- `[Ridge_WindExposure]` — açık sırt rüzgar riski
- `[Slope_FireSpreadCritical]` — yamaç + rüzgar + kuru koşul
- `[Slope_SouthWindHazard]` — güney rüzgarı (135°–225°) + yamaç baca etkisi

---

## Open-Meteo Hava Entegrasyonu

[Open-Meteo](https://open-meteo.com/) (API anahtarsız, ücretsiz) her bölgenin koordinatları için gerçek yağış verisi çeker. Son 30 günlük yağış toplamı kuraklık koşulunu belirler; bu da risk eşiklerini gerçek zamanlı ayarlar.

---

## Veritabanı Şeması

### PostgreSQL (TimescaleDB) Tabloları

| Tablo | Tür | Açıklama |
|---|---|---|
| `sensor_readings` | hypertable | Ham sensör verisi, zaman indeksli |
| `risk_scores` | hypertable | Bölge başına hesaplanan risk skoru + senaryo etiketi |
| `alarms` | normal tablo | OPEN/CLOSED yaşam döngüsüyle alarm durumu |
| `alarm_events` | normal tablo | Değiştirilemez denetim izi — her OPENED/CLOSED olayı |
| `zones` | normal tablo | Bölge meta verisi + güncel kuraklık indeksi |
| `weather_cache` | normal tablo | Open-Meteo fetch geçmişi |

---

## Ortam Değişkenleri

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

# Open-Meteo (API anahtarsız)
OPEN_METEO_URL=https://api.open-meteo.com/v1

# Backend
BACKEND_PORT=3001
WEBSOCKET_PORT=3002
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
| Mosquitto (MQTT) | mqtt://localhost:1883 | — |

---

## API Referansı

Tam API dokümantasyonu için bkz: [docs/API.md](docs/API.md)

---

*PyroSense — Bitirme Tezi, 2026*
