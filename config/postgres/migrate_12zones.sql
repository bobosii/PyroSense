-- ============================================================
--  PyroSense — 12 Bölge Geçiş Scripti
--  Mevcut çalışan veritabanına uygulanacak.
--
--  Çalıştırma:
--    docker exec -i pyrosense-postgres psql -U pyrosense -d pyrosense \
--      < config/postgres/migrate_12zones.sql
-- ============================================================

-- 1. risk_scores tablosuna scenario kolonu ekle (yoksa)
ALTER TABLE risk_scores ADD COLUMN IF NOT EXISTS scenario TEXT;

-- 2. Eski zone kayıtlarını temizle
DELETE FROM zones WHERE zone_id IN ('zone_a', 'zone_b', 'zone_c');

-- 3. 12 yeni bölgeyi ekle
INSERT INTO zones (zone_id, name, forest_type, latitude, longitude, topology, drought_index) VALUES
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

-- Doğrulama
SELECT zone_id, name, forest_type, topology FROM zones ORDER BY zone_id;
