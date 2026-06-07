# PyroSense API Referansı

PyroSense üç ayrı API sunar: arka uç REST API'si, WebSocket gerçek zamanlı akışı ve simülatör senaryo kontrolü.

---

## İçindekiler

- [Backend REST API](#backend-rest-api)
  - [GET /weather](#get-weather)
  - [GET /alarms](#get-alarms)
  - [GET /active-alarms](#get-active-alarms)
  - [GET /validation-metrics](#get-validation-metrics)
  - [GET /health](#get-health)
  - [GET /history/:zoneId](#get-historyzoneid)
- [WebSocket API](#websocket-api)
  - [Bağlantı](#bağlantı)
  - [RISK_UPDATE Mesajı](#risk_update-mesajı)
- [Simülatör Senaryo API](#simülatör-senaryo-api)
  - [POST /scenario](#post-scenario)
- [Fuseki SPARQL Endpoint](#fuseki-sparql-endpoint)
  - [SELECT Sorgusu](#select-sorgusu)
  - [UPDATE Sorgusu](#update-sorgusu)

---

## Backend REST API

**Temel URL:** `http://localhost:3001`

Frontend Vite geliştirme sunucusu üzerinden kullanıldığında `http://localhost:5173/api/*` → `http://localhost:3001/*` proxy'lenir.

Tüm endpoint'ler JSON döner. Hata durumunda `{ "error": "<mesaj>" }` formatında HTTP 500 yanıtı verir.

---

### GET /weather

Tüm bölgeler için en güncel hava durumu verisini döner. Her bölgeden yalnızca son kayıt gelir.

**İstek**
```
GET http://localhost:3001/weather
```

**Yanıt** — `200 OK`
```json
[
  {
    "zone_id": "zone_redpine",
    "temperature": 24.3,
    "humidity": 52.1,
    "wind_speed": 3.8,
    "wind_direction": 220,
    "precipitation_30d": 18.4,
    "drought_class": "ModerateDrought",
    "fetched_at": "2026-05-19T18:00:00.000Z"
  }
]
```

**Alan Açıklamaları**

| Alan | Tür | Açıklama |
|---|---|---|
| `zone_id` | string | Bölge tanımlayıcısı |
| `temperature` | float | Ortam sıcaklığı (°C) |
| `humidity` | float | Bağıl nem (%) |
| `wind_speed` | float | Rüzgar hızı (m/s) |
| `wind_direction` | integer | Rüzgar yönü (0–360°) |
| `precipitation_30d` | float | Son 30 günlük toplam yağış (mm) |
| `drought_class` | string | `NormalMoisture` \| `ModerateDrought` \| `ExtremeDrought` |
| `fetched_at` | ISO 8601 | Verinin çekildiği zaman |

---

### GET /alarms

PostgreSQL `alarms` tablosundan en son 20 alarm kaydını döner. Her kayıt bir alarmın yaşam döngüsünü (`OPEN` / `CLOSED`) temsil eder.

**İstek**
```
GET http://localhost:3001/alarms
```

**Yanıt** — `200 OK`
```json
[
  {
    "id": 42,
    "zone_id": "zone_redpine",
    "level": "HIGH",
    "message": "FLAME_DETECTED, SMOKE_ALARM",
    "status": "CLOSED",
    "created_at": "2026-05-19T14:32:00.000Z",
    "closed_at": "2026-05-19T14:48:00.000Z"
  },
  {
    "id": 43,
    "zone_id": "zone_shrubland",
    "level": "EXTREME",
    "message": "FLAME_DETECTED, SMOKE_ALARM, SLOPE_FIRE_SPREAD_CRITICAL",
    "status": "OPEN",
    "created_at": "2026-05-19T18:05:00.000Z",
    "closed_at": null
  }
]
```

**Alan Açıklamaları**

| Alan | Tür | Açıklama |
|---|---|---|
| `id` | integer | Birincil anahtar |
| `zone_id` | string | Bölge tanımlayıcısı |
| `level` | string | `LOW` \| `MODERATE` \| `HIGH` \| `EXTREME` |
| `message` | string | Tetiklenen OWL bayraklarının virgülle ayrılmış listesi |
| `status` | string | `OPEN` \| `CLOSED` |
| `created_at` | ISO 8601 | Alarmın açıldığı zaman |
| `closed_at` | ISO 8601 \| null | Alarmın kapandığı zaman; henüz kapanmadıysa `null` |

---

### GET /active-alarms

PostgreSQL `alarms` tablosundan durumu `OPEN` olan aktif alarmları döner. Her bölgeden yalnızca en son aktif alarm gelir.

**İstek**
```
GET http://localhost:3001/active-alarms
```

**Yanıt** — `200 OK`
```json
[
  {
    "zone_id": "zone_shrubland",
    "level": "EXTREME",
    "message": "FLAME_DETECTED, SMOKE_ALARM",
    "created_at": "2026-05-19T18:05:12.000Z"
  }
]
```

Aktif alarm yoksa boş dizi `[]` döner.

---

### GET /validation-metrics

`risk_scores` tablosundaki tüm kayıtları simülatör senaryo etiketleriyle karşılaştırarak doğrulama metriklerini hesaplar. Analytics sayfası bu endpoint'i kullanır.

**İstek**
```
GET http://localhost:3001/validation-metrics
```

**Yanıt** — `200 OK`
```json
{
  "activeFireDetection": {
    "truePositive": 232,
    "falseNegative": 17,
    "precision": 0.652,
    "recall": 0.932
  },
  "dangerDetection": {
    "truePositive": 223,
    "falseNegative": 24,
    "recall": 0.903
  },
  "normalConditions": {
    "falsePositive": 124,
    "trueNegative": 1217,
    "specificity": 0.908
  },
  "sensorFault": {
    "falseAlarms": 33,
    "correctlySuppressed": 88
  },
  "totalReadings": 1834
}
```

**Alan Açıklamaları**

| Alan | Açıklama |
|---|---|
| `activeFireDetection.truePositive` | `activefire` senaryosunda HIGH/EXTREME tespit edilen doğru sayı |
| `activeFireDetection.falseNegative` | `activefire` senaryosunda kaçırılan (LOW/MODERATE) sayı |
| `activeFireDetection.precision` | TP / (TP + FP) |
| `activeFireDetection.recall` | TP / (TP + FN) — tespit duyarlılığı |
| `dangerDetection.recall` | `prefire` senaryosunda MODERATE+ tespit hassasiyeti |
| `normalConditions.specificity` | TN / (TN + FP) |
| `sensorFault.correctlySuppressed` | `sensorFault` senaryosunda doğru baskılanan sayı |
| `totalReadings` | Tablodaki toplam kayıt sayısı |

Değer hesaplanamıyorsa (payda sıfır) `precision`, `recall`, `specificity` alanları `null` döner.

---

### GET /health

Tüm bağımlı servislerin (PostgreSQL, Fuseki, MQTT) sağlık durumunu döner. Monitoring ve hata ayıklama için kullanılır.

**İstek**
```
GET http://localhost:3001/health
```

**Yanıt** — `200 OK` (tümü sağlıklı) veya `207 Multi-Status` (en az biri hatalı)
```json
{
  "postgres": { "ok": true },
  "fuseki":   { "ok": true, "detail": "365 triple" },
  "mqtt":     { "ok": true }
}
```

Bir servis hatalıysa `"ok": false` ve `"detail"` alanında hata mesajı döner.

---

### GET /history/:zoneId

Belirli bir bölge ve zaman aralığı için ham sensör okumalarını döner. Analytics sayfasındaki Tarihsel Sensör Verisi paneli bu endpoint'i kullanır.

**İstek**
```
GET http://localhost:3001/history/{zoneId}?from=&to=&limit=&format=
```

**Sorgu Parametreleri**

| Parametre | Tür | Varsayılan | Açıklama |
|---|---|---|---|
| `zoneId` | string | — | Bölge tanımlayıcısı (URL path) |
| `from` | ISO 8601 | Son 24 saat | Başlangıç zamanı |
| `to` | ISO 8601 | Şimdi | Bitiş zamanı |
| `limit` | integer | 200 | Maksimum satır sayısı (en fazla 1000) |
| `format` | string | — | `csv` geçilirse CSV dosyası indirilir |

**Yanıt** — `200 OK` (JSON)
```json
[
  {
    "time": "2026-05-19T14:00:00.000Z",
    "temperature": 32.4,
    "humidity": 28.1,
    "smoke_ppm": 12.3,
    "wind_speed_ms": 4.2,
    "wind_dir_deg": 218,
    "flame_detected": false,
    "co2_ppm": 421.0,
    "scenario": "normal"
  }
]
```

**CSV İndirme**
```
GET http://localhost:3001/history/zone_redpine?from=2026-05-19T00:00:00Z&format=csv
```
`Content-Disposition: attachment; filename="zone_redpine_history.csv"` başlığıyla CSV döner.

---

## WebSocket API

**URL:** `ws://localhost:3002`

Tüm aktif WebSocket bağlantılarına her sensör okuması işlendiğinde otomatik olarak mesaj iletilir. Yeniden bağlantı mantığı frontend tarafında uygulanmıştır (3 saniyelik aralıkla otomatik tekrar bağlantı).

### Bağlantı

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => console.log('Bağlandı');
ws.onclose = () => setTimeout(() => connect(), 3000);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'RISK_UPDATE') {
    // msg.flags      → string[]       (tetiklenen kural kimlikleri)
    // msg.reasoningLog → ReasoningEntry[] (ağırlık + koşul detayı)
  }
};
```

### RISK_UPDATE Mesajı

Tek mesaj türü `RISK_UPDATE`'tir. Her sensör okumasının tamamlanmasından sonra tüm bağlı istemcilere gönderilir.

```json
{
  "type": "RISK_UPDATE",
  "zoneId": "zone_redpine",
  "score": 75,
  "level": "HIGH",
  "flags": ["FLAME_DETECTED", "SMOKE_ALARM"],
  "reasoningLog": [
    {
      "rule": "FLAME_DETECTED",
      "label": "Alev Tespiti",
      "condition": "RedPine | Alev sensörü aktif sinyal verdi (52.3°C)",
      "weight": 65
    },
    {
      "rule": "SMOKE_ALARM",
      "label": "Duman Alarmı",
      "condition": "RedPine | Duman 680 ppm (kuraklık çarpanı: ×1.0)",
      "weight": 35
    }
  ],
  "forestType": "RedPine",
  "topology": "Slope",
  "temperature": 52.3,
  "humidity": 12.4,
  "smokePpm": 680.0,
  "windSpeedMs": 7.2,
  "timeStamp": "2026-05-19T18:06:30.000Z",
  "scenario": "activefire",
  "alarm": {
    "active": true,
    "justOpened": true,
    "justClosed": false
  }
}
```

**Üst Düzey Alanlar**

| Alan | Tür | Açıklama |
|---|---|---|
| `type` | string | Her zaman `"RISK_UPDATE"` |
| `zoneId` | string | Bölge tanımlayıcısı (örn. `"zone_redpine"`) |
| `score` | integer | Hesaplanan risk skoru (0–100) |
| `level` | string | `"LOW"` \| `"MODERATE"` \| `"HIGH"` \| `"EXTREME"` |
| `flags` | string[] | Tetiklenen OWL kural kimliklerinin listesi |
| `reasoningLog` | ReasoningEntry[] | Her bayrağın ağırlık + koşul detayı |
| `forestType` | string | Orman tipi (örn. `"RedPine"`, `"Oak"`) |
| `topology` | string | `"Slope"` \| `"Ridge"` \| `"Valley"` \| `"Plain"` |
| `temperature` | float | Sensör sıcaklığı (°C) |
| `humidity` | float | Bağıl nem (%) |
| `smokePpm` | float | Duman yoğunluğu (PPM) |
| `windSpeedMs` | float | Rüzgar hızı (m/s) |
| `timeStamp` | ISO 8601 | Okuma zamanı |
| `scenario` | string | Simülatör senaryo etiketi |
| `alarm` | AlarmState | Alarm durumu |

**ReasoningEntry Nesnesi**

| Alan | Tür | Açıklama |
|---|---|---|
| `rule` | string | Kural kimliği (örn. `"FLAME_DETECTED"`) |
| `label` | string | Türkçe etiket (OWL'dan veya statik fallback'ten) |
| `condition` | string | Tetikleme koşulunun metin açıklaması |
| `weight` | integer | Risk skoruna katkı ağırlığı |

**AlarmState Nesnesi**

| Alan | Tür | Açıklama |
|---|---|---|
| `active` | boolean | Şu an açık alarm var mı |
| `justOpened` | boolean | Bu okumada alarm yeni açıldı mı |
| `justClosed` | boolean | Bu okumada alarm yeni kapandı mı |

**Risk Seviyeleri ve Eşikler**

| Skor Aralığı | Level |
|---|---|
| 0–34 | `LOW` |
| 35–59 | `MODERATE` |
| 60–79 | `HIGH` |
| 80–100 | `EXTREME` |

**Alarm Durum Makinesi**

| Parametre | Değer |
|---|---|
| Açılma eşiği | skor ≥ 55 |
| Kapanma eşiği | skor < 45 |
| Soğuma süresi | 10 dakika (EXTREME senaryolarında bypass edilir) |

Alarm açıldığında ve kapandığında PostgreSQL `alarms` ve `alarm_events` tablolarına kayıt düşülür.

---

## Simülatör Senaryo API

**Temel URL:** `http://localhost:8090`

Frontend üzerinden kullanıldığında `/scenario` → `http://localhost:8090/scenario` proxy'lenir.

---

### POST /scenario

Belirli bir bölgenin simülasyon senaryosunu değiştirir. Değişiklik bir sonraki sensör okuma döngüsünde (≤30s) etkili olur.

**İstek**
```
POST http://localhost:8090/scenario
Content-Type: application/json
```

```json
{
  "scenario": "activefire",
  "zone_id": "zone_redpine"
}
```

**İstek Parametreleri**

| Alan | Tür | Zorunlu | Açıklama |
|---|---|---|---|
| `scenario` | string | ✓ | `normal` \| `prefire` \| `activefire` \| `sensorFault` |
| `zone_id` | string | ✓ | Hedef bölge tanımlayıcısı |

**Yanıt** — `200 OK`
```json
{
  "success": true,
  "message": "zone_id=zone_redpine → activefire senaryosuna geçildi"
}
```

Bilinmeyen senaryo adı gönderilirse `"success": false` ve hata mesajı döner.

**Senaryo Özellikleri**

| Senaryo | Sıcaklık | Nem | Duman (PPM) | Alev | CO₂ (PPM) |
|---|---|---|---|---|---|
| `normal` | Günlük döngü (12–28°C) | %40–80 | ~5 | false | ~415 |
| `prefire` | Normal +7°C | %8–25 | 80–350 | false | ~450 |
| `activefire` | 45–70°C | %3–15 | 500–1000 | **true** | ~2000 |
| `sensorFault` | 999.9°C (geçersiz) | -1% (geçersiz) | rastgele | null | null |

**Tam Test Akışı**

```bash
# 1. Aktif yangın başlat
curl -X POST http://localhost:8090/scenario \
  -H "Content-Type: application/json" \
  -d '{"scenario": "activefire", "zone_id": "zone_redpine"}'

# 2. Backend log'unda "ALARM ACILDI" mesajını bekle (~30–60s)

# 3. Normal'e dön (alarm kapanma eşiği: skor < 45)
curl -X POST http://localhost:8090/scenario \
  -H "Content-Type: application/json" \
  -d '{"scenario": "normal", "zone_id": "zone_redpine"}'

# 4. Tüm bölgeleri normal'e sıfırla
for zone in zone_redpine zone_blackpine zone_scotspine zone_tauruscedar \
            zone_silverfir zone_orientalspruce zone_oak zone_orientalbeech \
            zone_alder zone_shrubland zone_juniper zone_mixed; do
  curl -s -X POST http://localhost:8090/scenario \
    -H "Content-Type: application/json" \
    -d "{\"scenario\": \"normal\", \"zone_id\": \"$zone\"}"
done
```

---

## Fuseki SPARQL Endpoint

**Temel URL:** `http://localhost:3030/pyrosense`
**Kimlik doğrulama:** Basic Auth — `admin:pyrosense123`

Named graph: `http://pyrosense.io/ontology`

### SELECT Sorgusu

```bash
curl -G http://localhost:3030/pyrosense/sparql \
  -u admin:pyrosense123 \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode "query=
    PREFIX pyro: <http://pyrosense.io/ontology#>
    SELECT ?rule ?weight ?label
    WHERE {
      GRAPH <http://pyrosense.io/ontology> {
        ?r pyro:ruleId     ?rule ;
           pyro:ruleWeight ?weight ;
           rdfs:label      ?label .
      }
    }
    ORDER BY DESC(?weight)
  "
```

**Triple sayısını doğrula**
```bash
curl -G http://localhost:3030/pyrosense/sparql \
  -u admin:pyrosense123 \
  -H "Accept: application/sparql-results+json" \
  --data-urlencode "query=
    SELECT (COUNT(*) AS ?n)
    WHERE { GRAPH <http://pyrosense.io/ontology> { ?s ?p ?o } }
  "
```

### UPDATE Sorgusu

```bash
curl -X POST http://localhost:3030/pyrosense/update \
  -u admin:pyrosense123 \
  -H "Content-Type: application/sparql-update" \
  -d "
    PREFIX pyro: <http://pyrosense.io/ontology#>
    INSERT DATA {
      GRAPH <http://pyrosense.io/ontology> {
        pyro:TestTriple pyro:test \"hello\" .
      }
    }
  "
```

---

## Hata Kodları

| HTTP Kodu | Durum | Açıklama |
|---|---|---|
| `200 OK` | Başarı | İstek başarıyla tamamlandı |
| `207 Multi-Status` | Kısmi hata | `/health` — en az bir servis hatalı |
| `500 Internal Server Error` | Sunucu hatası | Veritabanı veya sorgu hatası; gövdede `{ "error": "..." }` |

WebSocket bağlantısı koptuğunda frontend 3 saniye sonra otomatik yeniden bağlanır.

---

*PyroSense — Bitirme Tezi, 2026*
