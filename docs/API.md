# PyroSense API Referansı

PyroSense üç ayrı API sunar: arka uç REST API'si, WebSocket gerçek zamanlı akışı ve simülatör senaryo kontrolü.

---

## İçindekiler

- [Backend REST API](#backend-rest-api)
  - [GET /weather](#get-weather)
  - [GET /alarms](#get-alarms)
  - [GET /active-alarms](#get-active-alarms)
  - [GET /validation-metrics](#get-validation-metrics)
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
  },
  {
    "zone_id": "zone_oak",
    "temperature": 19.7,
    "humidity": 68.0,
    "wind_speed": 2.1,
    "wind_direction": 180,
    "precipitation_30d": 47.2,
    "drought_class": "NormalMoisture",
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

MongoDB'deki alarm olay günlüğünden en son 20 olayı döner. Bu kayıtlar değiştirilemez; her `OPENED` ve `CLOSED` olayı ayrı birer belge olarak saklanır.

**İstek**
```
GET http://localhost:3001/alarms
```

**Yanıt** — `200 OK`
```json
[
  {
    "_id": "6629a1f3c4e2b10012345678",
    "zoneId": "zone_redpine",
    "event": "OPENED",
    "level": "HIGH",
    "score": 75,
    "flags": ["FLAME_DETECTED", "SMOKE_ALARM"],
    "timestamp": "2026-05-19T14:32:00.000Z"
  },
  {
    "_id": "6629a2a0c4e2b10012345679",
    "zoneId": "zone_redpine",
    "event": "CLOSED",
    "level": "LOW",
    "score": 10,
    "flags": [],
    "timestamp": "2026-05-19T14:48:00.000Z"
  }
]
```

**Alan Açıklamaları**

| Alan | Tür | Açıklama |
|---|---|---|
| `_id` | string | MongoDB belge kimliği |
| `zoneId` | string | Bölge tanımlayıcısı |
| `event` | string | `OPENED` \| `CLOSED` |
| `level` | string | Olay anındaki risk seviyesi |
| `score` | integer | Olay anındaki risk skoru (0–100) |
| `flags` | string[] | Tetiklenen OWL bayrakları |
| `timestamp` | ISO 8601 | Olay zamanı |

---

### GET /active-alarms

PostgreSQL'deki `alarms` tablosundan durum `OPEN` olan aktif alarmları döner. Her bölgeden yalnızca en son aktif alarm gelir.

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
    "message": "Risk score: 95",
    "created_at": "2026-05-19T18:05:12.000Z"
  }
]
```

Aktif alarm yoksa boş dizi `[]` döner.

**Alan Açıklamaları**

| Alan | Tür | Açıklama |
|---|---|---|
| `zone_id` | string | Bölge tanımlayıcısı |
| `level` | string | `LOW` \| `MODERATE` \| `HIGH` \| `EXTREME` |
| `message` | string | İnsan okunabilir alarm açıklaması |
| `created_at` | ISO 8601 | Alarmın açıldığı zaman |

---

### GET /validation-metrics

`risk_scores` tablosundaki tüm kayıtları simülatör senaryo etiketleriyle karşılaştırarak doğrulama metriklerini hesaplar. Analytics sayfası bu endpoint'i kullanır ve her yeni sensör okuması geldiğinde otomatik yenilenir.

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
| `activeFireDetection.precision` | TP / (TP + FP) — yanlış alarm oranının tersi |
| `activeFireDetection.recall` | TP / (TP + FN) — tespit duyarlılığı |
| `dangerDetection.truePositive` | `prefire` senaryosunda MODERATE+ tespit edilen doğru sayı |
| `dangerDetection.recall` | Tehlike tespit hassasiyeti |
| `normalConditions.falsePositive` | `activefire` olmayan senaryolarda yanlış HIGH/EXTREME sayısı |
| `normalConditions.trueNegative` | `normal` senaryosunda doğru LOW tespiti |
| `normalConditions.specificity` | TN / (TN + FP) |
| `sensorFault.falseAlarms` | `sensorFault` senaryosunda yanlış HIGH/EXTREME sayısı |
| `sensorFault.correctlySuppressed` | `sensorFault` senaryosunda doğru baskılanan sayı |
| `totalReadings` | Tablodaki toplam kayıt sayısı |

Değer hesaplanamıyorsa (paydası sıfır) `precision`, `recall`, `specificity` alanları `null` döner.

---

## WebSocket API

**URL:** `ws://localhost:3002`

Tüm aktif WebSocket bağlantılarına her sensör okuması işlendiğinde otomatik olarak mesaj iletilir. Yeniden bağlantı mantığı frontend tarafında uygulanmıştır (3 saniyelik aralıkla otomatik tekrar bağlantı).

### Bağlantı

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = () => console.log('Bağlandı');
ws.onclose = () => setTimeout(() => connect(), 3000); // Otomatik yeniden bağlantı

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'RISK_UPDATE') {
    // Mesajı işle
  }
};
```

### RISK_UPDATE Mesajı

Tek mesaj türü vardır: `RISK_UPDATE`. Her sensör okumasının tamamlanmasının ardından tüm bağlı istemcilere gönderilir.

```json
{
  "type": "RISK_UPDATE",
  "zoneId": "zone_redpine",
  "score": 75,
  "level": "HIGH",
  "flags": [
    {
      "rule": "FLAME_DETECTED",
      "label": "Alev Tespiti",
      "condition": "flame_detected = true",
      "weight": 65
    },
    {
      "rule": "SMOKE_ALARM",
      "label": "Duman Alarmı",
      "condition": "smoke_ppm > threshold",
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
| `flags` | Flag[] | Tetiklenen OWL kurallarının listesi |
| `forestType` | string | Orman tipi (örn. `"RedPine"`, `"Oak"`) |
| `topology` | string | `"Slope"` \| `"Ridge"` \| `"Valley"` \| `"Plain"` |
| `temperature` | float | Sensör sıcaklığı (°C) |
| `humidity` | float | Bağıl nem (%) |
| `smokePpm` | float | Duman yoğunluğu (PPM) |
| `windSpeedMs` | float | Rüzgar hızı (m/s) |
| `timeStamp` | ISO 8601 | Okuma zamanı |
| `alarm` | AlarmState | Alarm durumu |

**Flag Nesnesi**

| Alan | Tür | Açıklama |
|---|---|---|
| `rule` | string | Kural tanımlayıcısı (örn. `"FLAME_DETECTED"`) |
| `label` | string | İnsan okunabilir Türkçe etiket |
| `condition` | string | Tetikleme koşulu açıklaması |
| `weight` | integer | Risk skoruna katkı ağırlığı |

**AlarmState Nesnesi**

| Alan | Tür | Açıklama |
|---|---|---|
| `active` | boolean | Şu an açık alarm var mı |
| `justOpened` | boolean | Bu okumada alarm yeni açıldı mı |
| `justClosed` | boolean | Bu okumada alarm yeni kapandı mı |

**Risk Seviyeleri ve Eşikler**

| Skor Aralığı | Level | Alarm Davranışı |
|---|---|---|
| 0 – 34 | `LOW` | Alarm kapalı |
| 35 – 59 | `MODERATE` | Alarm kapalı |
| 60 – 79 | `HIGH` | Skor ≥ 70 ise alarm açılır |
| 80 – 100 | `EXTREME` | Alarm açılır |

Alarm açılma eşiği 70, kapanma eşiği 45'tir (histerezis). Son kapanmadan bu yana 10 dakika geçmeden yeni alarm açılmaz.

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
{ "ok": true }
```

**Senaryo Özellikleri**

| Senaryo | Sıcaklık | Nem | Duman (PPM) | Alev | CO₂ (PPM) |
|---|---|---|---|---|---|
| `normal` | Günlük döngü (12–28°C) | %40–80 | ~5 | false | ~400 |
| `prefire` | Normal +7°C | %8–25 | 80–350 | false | 600–900 |
| `activefire` | 45–70°C | %5–15 | 500–1000 | **true** | ~2000 |
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
           pyro:ruleLabel  ?label .
      }
    }
    ORDER BY DESC(?weight)
  "
```

**Örnek Yanıt**
```json
{
  "results": {
    "bindings": [
      {
        "rule":   { "value": "FLAME_DETECTED" },
        "weight": { "value": "65" },
        "label":  { "value": "Alev Tespiti" }
      },
      {
        "rule":   { "value": "SMOKE_ALARM" },
        "weight": { "value": "35" },
        "label":  { "value": "Duman Alarmı" }
      }
    ]
  }
}
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

Beklenen sonuç: `"n": { "value": "365" }`

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
| `500 Internal Server Error` | Sunucu hatası | Veritabanı bağlantısı veya sorgu hatası; gövdede `{ "error": "..." }` |

WebSocket bağlantısı koptuğunda frontend 3 saniye sonra otomatik yeniden bağlanır. Bağlantı durumu `CANLI` / `BAĞLANTI YOK` göstergesiyle arayüzde görünür.

---

*PyroSense — Bitirme Tezi, 2026*
