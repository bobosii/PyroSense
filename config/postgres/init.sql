-- ============================================================
--  PyroSense — PostgreSQL + TimescaleDB Başlangıç Şeması
-- ============================================================

-- TimescaleDB eklentisini etkinleştir
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ----------------------------------------------------------
-- Sensör Okuma Tablosu (zaman serisi ana tablo)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS sensor_readings (
    time            TIMESTAMPTZ     NOT NULL,
    device_id       TEXT            NOT NULL,
    zone_id         TEXT            NOT NULL,
    temperature     FLOAT,          -- °C
    humidity        FLOAT,          -- %
    smoke_ppm       FLOAT,          -- PPM
    uv_index        FLOAT,          -- W/m²
    wind_speed_ms   FLOAT,          -- m/s
    wind_dir_deg    INTEGER,        -- 0-360 derece
    flame_detected  BOOLEAN,
    co2_ppm         FLOAT,          -- PPM (opsiyonel)
    battery_pct     INTEGER,        -- % (simülasyonda 100 sabit)
    scenario        TEXT            -- 'normal' | 'prefire' | 'activefire' | 'sensorFault'
);

-- TimescaleDB hypertable'a çevir (zaman serisi optimizasyonu)
SELECT create_hypertable('sensor_readings', 'time', if_not_exists => TRUE);

-- Performans index'leri
CREATE INDEX IF NOT EXISTS idx_sensor_device ON sensor_readings (device_id, time DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_zone   ON sensor_readings (zone_id, time DESC);

-- ----------------------------------------------------------
-- Risk Skoru Tablosu
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_scores (
    time        TIMESTAMPTZ     NOT NULL,
    zone_id     TEXT            NOT NULL,
    score       INTEGER         NOT NULL,   -- 0-100
    level       TEXT            NOT NULL,   -- NEGLIGIBLE | LOW | MODERATE | HIGH | EXTREME
    source      TEXT            DEFAULT 'ontology',  -- 'ontology' | 'fallback'
    sparql_uri  TEXT,                       -- Fuseki'deki triple URI'si
    scenario    TEXT                        -- simülatör ground truth: normal | prefire | activefire | sensorFault
);

SELECT create_hypertable('risk_scores', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_risk_zone ON risk_scores (zone_id, time DESC);

-- ----------------------------------------------------------
-- Alarm Tablosu
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS alarms (
    id              SERIAL          PRIMARY KEY,
    created_at      TIMESTAMPTZ     DEFAULT NOW(),
    zone_id         TEXT            NOT NULL,
    level           TEXT            NOT NULL,
    message         TEXT,
    status          TEXT            DEFAULT 'OPEN',  -- OPEN | CLOSED
    closed_at       TIMESTAMPTZ,                     -- kapanma zamanı
    acknowledged    BOOLEAN         DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    notified_email  BOOLEAN         DEFAULT FALSE,
    notified_sms    BOOLEAN         DEFAULT FALSE
);

-- ----------------------------------------------------------
-- Bölge (Zone) Tanımları
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS zones (
    zone_id         TEXT            PRIMARY KEY,
    name            TEXT,
    forest_type     TEXT,           -- 'conifer' | 'deciduous' | 'mixed' | 'shrub'
    latitude        FLOAT,
    longitude       FLOAT,
    topology        TEXT,           -- 'valley' | 'slope' | 'ridge' | 'plain'
    drought_index   TEXT            DEFAULT 'NormalMoisture'
);

-- 12 Türkiye orman tipi bölgesi — her orman tipi için bir sensör düğümü
INSERT INTO zones VALUES
    ('zone_redpine',        'Kızılçam — Muğla/Menteşe',          'conifer',   37.2151, 28.3627, 'slope',  'NormalMoisture'),
    ('zone_blackpine',      'Karaçam — Kastamonu',               'conifer',   41.3780, 33.7743, 'ridge',  'NormalMoisture'),
    ('zone_scotspine',      'Sarıçam — Sarıkamış/Kars',          'conifer',   40.3334, 42.5905, 'ridge',  'NormalMoisture'),
    ('zone_tauruscedar',    'Toros Sediri — Toros Dağları',      'conifer',   37.1000, 34.6000, 'slope',  'NormalMoisture'),
    ('zone_silverfir',      'Göknar — Bolu/Abant',               'conifer',   40.7350, 31.6000, 'slope',  'NormalMoisture'),
    ('zone_orientalspruce', 'Doğu Ladini — Rize/Artvin',         'conifer',   41.0500, 40.5000, 'slope',  'NormalMoisture'),
    ('zone_oak',            'Meşe — Kızılcahamam/Ankara',        'deciduous', 40.4697, 32.6558, 'valley', 'NormalMoisture'),
    ('zone_orientalbeech',  'Doğu Kayını — Karabük/Yenice',      'deciduous', 41.2000, 32.6000, 'slope',  'NormalMoisture'),
    ('zone_alder',          'Kızılağaç — Göksu Deltası/Mersin',  'deciduous', 36.3000, 33.9833, 'valley', 'NormalMoisture'),
    ('zone_shrubland',      'Maki — Antalya Kıyısı',             'shrub',     36.8841, 30.7056, 'slope',  'NormalMoisture'),
    ('zone_juniper',        'Ardıç — Beyşehir/Konya',            'conifer',   37.6750, 31.7250, 'plain',  'NormalMoisture'),
    ('zone_mixed',          'Karma — Belgrad Ormanı/İstanbul',   'mixed',     41.1944, 28.9514, 'valley', 'NormalMoisture')
ON CONFLICT (zone_id) DO UPDATE SET
    name        = EXCLUDED.name,
    forest_type = EXCLUDED.forest_type,
    latitude    = EXCLUDED.latitude,
    longitude   = EXCLUDED.longitude,
    topology    = EXCLUDED.topology;

-- ----------------------------------------------------------
-- Hava Durumu Önbelleği (Open-Meteo)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_cache (
    id              SERIAL          PRIMARY KEY,
    fetched_at      TIMESTAMPTZ     DEFAULT NOW(),
    zone_id         TEXT,
    temperature     FLOAT,
    humidity        FLOAT,
    wind_speed      FLOAT,
    wind_direction  INTEGER,
    precipitation_30d FLOAT,        -- Son 30 günlük toplam yağış (mm)
    drought_class   TEXT            -- 'NormalMoisture' | 'ModerateDrought' | 'ExtremeDrought'
);
