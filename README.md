# PyroSense 🔥

**OWL Ontology-Based Forest Fire Early Warning System**

PyroSense is a graduation thesis project that implements a semantically-aware, real-time forest fire risk detection system for the Antalya forest region of Turkey. It uses an OWL 2 ontology + Jena rule engine to reason over live sensor data, calculates per-zone fire risk scores, and pushes alerts through a WebSocket gateway.

> **Status:** Full simulation mode — all sensor data is produced by a physics-based Rust simulator (advisor decision 25.03.2026).

---

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Sensor Nodes & Zones](#sensor-nodes--zones)
- [Simulation Scenarios](#simulation-scenarios)
- [Risk Scoring Engine](#risk-scoring-engine)
- [Ontology & Jena Rules](#ontology--jena-rules)
- [Open-Meteo Weather Integration](#open-meteo-weather-integration)
- [WebSocket API](#websocket-api)
- [Scenario Control API](#scenario-control-api)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Service URLs](#service-urls)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Rust Simulator                            │
│  Physics Engine (Gaussian noise + Weibull wind + diurnal cycle) │
│  EMA Filter (α=0.3) + WindWindow (10×30s sliding average)       │
│  HTTP API :8090  →  POST /scenario  (zone-level control)        │
└────────────────────────┬────────────────────────────────────────┘
                         │ MQTT  pyrosense/#
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Mosquitto Broker :1883                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  TypeScript Backend  :3001                       │
│                                                                  │
│  1. saveSensorReading()     → PostgreSQL / TimescaleDB           │
│  2. toRdfTurtle()           → RDF Turtle serialization           │
│  3. uploadTurtle()          → Apache Jena Fuseki  :3030          │
│  4. queryReading() (SPARQL) ← Fuseki semantic lookup             │
│  5. getZoneDrought()        ← PostgreSQL drought_index           │
│  6. calculateRisk()         → Additive flag scoring (0-100)      │
│  7. evaluateAlarm()         → Hysteresis (open≥70, close<45)     │
│  8. saveRiskScore()         → PostgreSQL                         │
│  9. broadcast()             → WebSocket Gateway  :3002           │
│ 10. saveAlarm/closeAlarm()  → PostgreSQL alarm state             │
│ 11. logAlarmEvent()         → MongoDB audit trail                │
└─────────────────────────────────────────────────────────────────┘
         │                │                │
         ▼                ▼                ▼
  PostgreSQL          MongoDB          WebSocket
  TimescaleDB         alarm_events     :3002
  :5434               :27017           (frontend)
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Simulator | **Rust** + Tokio + rumqttc + axum | Physics-based async sensor simulation |
| Message Bus | **Mosquitto** (MQTT 3.1.1) | Sensor → Backend message transport |
| Ontology Engine | **Apache Jena Fuseki** (OWL 2 + SPARQL) | Semantic reasoning over sensor triples |
| Backend | **Node.js / TypeScript** + ts-node | MQTT consumer + risk pipeline |
| Time-series DB | **PostgreSQL + TimescaleDB** | Sensor readings, risk scores, alarms |
| Document DB | **MongoDB** | Immutable alarm event audit log |
| Weather API | **Open-Meteo** (free, no key required) | Real 30-day precipitation → drought class |
| Real-time Push | **WebSocket** (ws library) | Live risk score delivery to frontend |
| Admin UIs | Adminer :8082, Mongo Express :8081 | Database inspection |

---

## Project Structure

```
PyroSense/
├── simulator/                  # Rust sensor simulator
│   ├── src/
│   │   ├── main.rs             # Entry point, node config, main loop
│   │   ├── models/sensor.rs    # SensorReading, NodeConfig, ForestType, Topology
│   │   ├── mqtt/               # MQTT publisher (rumqttc)
│   │   └── scenarios/mod.rs    # SensorPhysics, EmaFilter, WindWindow, FilterState
│   └── Cargo.toml
│
├── backend/                    # TypeScript backend
│   └── src/
│       ├── index.ts            # Startup: MQTT consumer + WS gateway + weather fetch
│       ├── constants/          # Env var loader
│       ├── types/sensor.ts     # SensorMessage type
│       └── services/
│           ├── mqttConsumer.ts     # Full 11-step pipeline
│           ├── rdfConverter.ts     # JSON → RDF Turtle + NaN sanitization
│           ├── fusekiClient.ts     # HTTP POST to Fuseki /data
│           ├── sparqlService.ts    # SPARQL SELECT → SparqlReading
│           ├── riskCalculator.ts   # Flag-based additive scoring
│           ├── alarmManager.ts     # Hysteresis + cooldown state machine
│           ├── weatherService.ts   # Open-Meteo fetch + drought classification
│           ├── weatherRepository.ts
│           ├── sensorRepository.ts
│           ├── riskRepository.ts
│           ├── alarmLogRepository.ts  # MongoDB writes
│           ├── wsGateway.ts        # WebSocket broadcast server
│           ├── database.ts         # PostgreSQL connection
│           └── mongoClient.ts      # MongoDB lazy singleton
│
├── ontology/
│   ├── pyrosense-core.owl      # OWL 2 ontology (classes, properties, individuals)
│   └── pyrosense-rules.jrl     # 63+ Jena rule language rules
│
├── config/
│   ├── mosquitto/mosquitto.conf
│   └── postgres/init.sql       # Schema + TimescaleDB hypertables + seed zones
│
├── docker-compose.yml          # All 6 infrastructure services
├── .env                        # Environment configuration
└── README.md
```

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Rust (stable, `cargo`)
- Node.js ≥ 18 + npm

### 1. Start Infrastructure

```bash
docker compose up -d
```

This starts 6 services: Mosquitto, Fuseki, PostgreSQL/TimescaleDB, MongoDB, Mongo Express, and Adminer.

### 2. Configure Fuseki Dataset

1. Open Fuseki UI at http://localhost:3030
2. Log in with `admin` / `pyrosense123`
3. Create a **persistent** dataset named `pyrosense`
4. Upload the ontology:
   - Go to the dataset → **add data**
   - Upload `ontology/pyrosense-core.owl` (format: Turtle or RDF/XML)

### 3. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The backend will:
- Connect to MQTT broker and subscribe to `pyrosense/#`
- Fetch weather data from Open-Meteo immediately, then every hour
- Start the WebSocket gateway on port 3002

### 4. Start the Simulator

```bash
cd simulator
cargo run
```

The simulator publishes one reading per node every 30 seconds (configurable via `PUBLISH_INTERVAL_SECS`).

---

## Sensor Nodes & Zones

Three simulated sensor nodes cover a forest area in the Antalya region:

| Zone | Node ID | Forest Type | Topology | Coordinates |
|---|---|---|---|---|
| zone_a | node_a_01 | Red Pine (Kızılçam) | Slope | 36.8969°N, 30.7133°E |
| zone_b | node_b_01 | Oak (Meşe) | Valley | 36.8800°N, 30.7000°E |
| zone_c | node_c_01 | Mixed (Karma) | Ridge | 36.9100°N, 30.7300°E |

Each sensor reading contains: `temperature`, `humidity`, `smoke_ppm`, `uv_index`, `wind_speed_ms`, `wind_dir_deg`, `flame_detected`, `co2_ppm`.

### Signal Processing

Before publishing, each node's raw readings pass through two filters:

- **EMA Filter** (α = 0.3) — applied to temperature and humidity. Simulates sensor thermal inertia; values gradually converge after a scenario change rather than jumping instantly.
- **WindWindow** (10 samples × 30s = 5 min) — sliding average for wind speed, following the RAWS (Remote Automated Weather Station) standard for sustained wind used in fire spread models.

---

## Simulation Scenarios

Scenarios are set per-zone via HTTP API. Four scenarios are available:

| Scenario | Key Characteristics |
|---|---|
| `normal` | Diurnal temperature cycle, low smoke (~5 ppm), Weibull wind distribution |
| `prefire` | Smoke 80–350 ppm, temperature +7°C above normal, humidity 8–25%, wind 4–15 m/s |
| `activefire` | `flame_detected=true`, smoke 500–1000 ppm, temp 45–70°C, CO₂ ~2000 ppm |
| `sensorFault` | Random invalid values (999.9°C, -1% humidity, null CO₂) to test sanitization |

Normal scenario uses realistic seasonal offsets (July/August highest risk) and forest-type-specific base temperatures, ranging from 12°C (Oriental Spruce) to 28°C (Shrubland).

---

## Risk Scoring Engine

Risk is computed in `riskCalculator.ts` using an **additive flag system**, not a simple threshold lookup.

### Step 1 — Drought Multiplier

Real weather data from Open-Meteo adjusts fire thresholds dynamically:

| Drought Class | 30-day Precipitation | Threshold Multiplier |
|---|---|---|
| `ExtremeDrought` | < 10 mm | × 0.80 (thresholds drop — harder to stay safe) |
| `ModerateDrought` | 10–40 mm | × 0.90 |
| `NormalMoisture` | ≥ 40 mm | × 1.00 |

Multiplier is applied to `droughtTemp`, `smokeAlarm`, and `spreadWind` thresholds.

### Step 2 — Flag Evaluation

Five forest-condition rules and three topology rules are checked:

| Flag | Condition |
|---|---|
| `FLAME_DETECTED` | `flameDetected === true` |
| `HIGH_DROUGHT_RISK` | `temp > droughtTemp` AND `humidity < droughtHum` |
| `SMOKE_ALARM` | `smokePpm > smokeAlarm` |
| `HIGH_SPREAD_RISK` | `windSpeed > spreadWind` AND `temp > spreadTemp` |
| `EARLY_FIRE_SIGNAL` | `co2 > earlySignalCo2` AND `smoke > earlySignalSmoke` |
| `VALLEY_WIND_AMPLIFICATION` | Valley topology AND `wind > 6` AND `temp > 25` |
| `RIDGE_WIND_EXPOSURE` | Ridge topology AND `wind > 8` |
| `SLOPE_FIRE_SPREAD_CRITICAL` | Slope topology AND `wind > 5` AND `humidity < 30` AND `temp > 30` |

### Step 3 — Additive Scoring

```
score = min(100, Σ weights[flag])
```

| Flag | Weight |
|---|---|
| FLAME_DETECTED | 65 |
| SLOPE_FIRE_SPREAD_CRITICAL | 30 |
| SMOKE_ALARM | 35 |
| EARLY_FIRE_SIGNAL | 25 |
| HIGH_SPREAD_RISK | 20 |
| HIGH_DROUGHT_RISK | 20 |
| VALLEY_WIND_AMPLIFICATION | 15 |
| RIDGE_WIND_EXPOSURE | 10 |

### Step 4 — Risk Level

| Score | Level |
|---|---|
| 0–34 | LOW |
| 35–59 | MODERATE |
| 60–79 | HIGH |
| 80–100 | EXTREME |

Thresholds are defined separately for all 12 forest types: RedPine, BlackPine, ScotsPine, TaurusCedar, SilverFir, OrientalSpruce, Oak, OrientalBeech, Alder, Shrubland, Juniper, Mixed.

### Alarm State Machine

Alarm state uses hysteresis to prevent rapid oscillation:

- **Open:** score ≥ 70 AND 10-minute cooldown has elapsed since last closure
- **Close:** score < 45
- `justOpened` and `justClosed` events trigger PostgreSQL state updates + MongoDB audit log entries

---

## Ontology & Jena Rules

### OWL 2 Core (`pyrosense-core.owl`)

Defines the class hierarchy and properties:
- `SensorNode` — has `forestType`, `topology`, GPS coordinates
- `SensorReading` — has temperature, humidity, smoke, wind, CO₂, flame properties; linked to a `SensorNode` via `ssn:isObservedBy`
- Named individuals for all 12 forest types and 3 topology types

### Jena Rule Language (`pyrosense-rules.jrl`)

63+ rules covering all 12 forest types × 4 condition categories:

- `[ForestType_HighDroughtRisk]` — high temperature + low humidity
- `[ForestType_SmokeAlarm]` — smoke PPM threshold
- `[ForestType_SpreadRisk]` — wind speed + temperature combination
- `[ForestType_EarlyFireSignal]` — CO₂ + smoke early warning

Plus 3 topology rules:
- `[Valley_WindAmplification]` — valley channeling effect
- `[Ridge_WindExposure]` — exposed ridge wind risk
- `[Slope_FireSpreadCritical]` — slope + wind + low humidity + heat

Each sensor reading is first converted to RDF Turtle and uploaded to Fuseki, then queried back via SPARQL so the TypeScript risk calculator works with ontology-enriched data.

---

## Open-Meteo Weather Integration

Real precipitation data from [Open-Meteo](https://open-meteo.com/) (no API key required) is fetched for each zone's coordinates. The last 30 days of daily precipitation are summed to classify drought conditions, which then adjust risk thresholds in real time.

Weather data is fetched on startup and refreshed every hour. Results are stored in the `weather_cache` table and the per-zone `drought_index` in the `zones` table.

---

## WebSocket API

Connect to `ws://localhost:3002` to receive real-time risk updates.

Each message is a JSON object pushed after every sensor reading is processed:

```json
{
  "type": "RISK_UPDATE",
  "zoneId": "zone_a",
  "score": 55,
  "level": "MODERATE",
  "flags": ["HIGH_DROUGHT_RISK", "EARLY_FIRE_SIGNAL"],
  "forestType": "RedPine",
  "topology": "Slope",
  "temperature": 38.5,
  "humidity": 18.2,
  "smokePpm": 47.3,
  "windSpeedMs": 6.1,
  "timeStamp": "2026-04-17T10:00:00Z",
  "alarm": {
    "active": false,
    "justOpened": false,
    "justClosed": false
  }
}
```

---

## Scenario Control API

The simulator exposes an HTTP REST API on port 8090 for controlling scenarios per zone.

**Change scenario:**
```bash
curl -X POST http://localhost:8090/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "prefire", "zone_id": "zone_a"}'
```

**Available scenarios:** `normal`, `prefire`, `activefire`, `sensorFault`

**Test the full alarm pipeline (zone_a → activefire):**
```bash
# Trigger active fire
curl -X POST http://localhost:8090/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "activefire", "zone_id": "zone_a"}'

# After observing ALARM ACILDI in backend logs, return to normal
curl -X POST http://localhost:8090/scenario \
     -H "Content-Type: application/json" \
     -d '{"scenario": "normal", "zone_id": "zone_a"}'
```

---

## Database Schema

### PostgreSQL (TimescaleDB) Tables

| Table | Type | Description |
|---|---|---|
| `sensor_readings` | hypertable | Raw sensor data, time-indexed |
| `risk_scores` | hypertable | Computed risk per zone per tick |
| `alarms` | regular | Alarm state with OPEN/CLOSED lifecycle |
| `zones` | regular | Zone metadata + current drought index |
| `weather_cache` | regular | Open-Meteo fetch history |

### MongoDB Collection

| Collection | Description |
|---|---|
| `alarm_events` | Immutable audit log — every OPENED and CLOSED event with full context |

---

## Environment Variables

Copy `.env` and adjust as needed. All variables are required by the backend.

```env
# MQTT
MQTT_URL=mqtt://localhost:1883
PUBLISH_INTERVAL_SECS=30

# Apache Jena Fuseki
FUSEKI_URL=http://localhost:3030
FUSEKI_DATASET=pyrosense
FUSEKI_USER=admin
FUSEKI_PASSWORD=pyrosense123

# PostgreSQL
DATABASE_URL=postgresql://pyrosense:pyrosense123@localhost:5434/pyrosense

# MongoDB
MONGO_URL=mongodb://pyrosense:pyrosense123@localhost:27017/pyrosense?authSource=admin

# Open-Meteo (no API key required)
OPEN_METEO_URL=https://api.open-meteo.com/v1

# Backend
BACKEND_PORT=3001
WEBSOCKET_PORT=3002
```

---

## Service URLs

| Service | URL | Credentials |
|---|---|---|
| Apache Jena Fuseki | http://localhost:3030 | admin / pyrosense123 |
| Adminer (PostgreSQL) | http://localhost:8082 | server: `postgres`, user: `pyrosense`, pass: `pyrosense123` |
| Mongo Express | http://localhost:8081 | — (no auth in dev) |
| Mosquitto (MQTT) | mqtt://localhost:1883 | — |
| Simulator API | http://localhost:8090 | — |
| WebSocket Gateway | ws://localhost:3002 | — |

---

## Persistence Strategy

PyroSense uses **polyglot persistence** — two databases with different roles:

- **PostgreSQL + TimescaleDB** — operational state. Alarm open/close status, acknowledged flags, time-series sensor and risk data. Optimized for time-range queries and zone-based lookups.
- **MongoDB** — immutable audit trail. Every alarm lifecycle event (`OPENED`, `CLOSED`) is written as an append-only document with full context (score, level, flags, timestamp). Never updated or deleted.

---

*PyroSense — Graduation Thesis, 2026*
