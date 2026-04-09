// ============================================================
//  PyroSense Senaryo Motoru
//  Gauss gürültüsü + Weibull rüzgar + günlük döngü
// ============================================================

use chrono::{Timelike, Utc};
use rand::Rng;
use rand_distr::{Distribution, Normal, Weibull};

use crate::models::sensor::{ForestType, NodeConfig, Readings, Topology};

/// Aktif senaryo türü
#[derive(Debug, Clone, PartialEq)]
pub enum Scenario {
    Normal,      // Günlük döngüyle uyumlu normal koşullar
    PreFire,     // Duman artışı, yüksek sıcaklık, düşük nem
    ActiveFire,  // Alev tespiti, maksimum duman ve sıcaklık
    SensorFault, // Anormal okuma atlama, NaN benzeri değerler
}

impl Scenario {
    pub fn name(&self) -> &str {
        match self {
            Scenario::Normal => "normal",
            Scenario::PreFire => "prefire",
            Scenario::ActiveFire => "activefire",
            Scenario::SensorFault => "sensorFault",
        }
    }
}

/// Fizik tabanlı sensör verisi üretici
pub struct SensorPhysics;

impl SensorPhysics {
    /// Ana üretim fonksiyonu — senaryo ve düğüm konfigürasyonuna göre okuma üretir
    pub fn generate(node: &NodeConfig, scenario: &Scenario) -> Readings {
        let mut rng = rand::thread_rng();
        let hour = Utc::now().hour();

        match scenario {
            Scenario::Normal => Self::normal(node, hour, &mut rng),
            Scenario::PreFire => Self::prefire(node, hour, &mut rng),
            Scenario::ActiveFire => Self::active_fire(node, &mut rng),
            Scenario::SensorFault => Self::sensor_fault(&mut rng),
        }
    }

    /// NORMAL SENARYO
    /// Günlük sıcaklık döngüsü (diurnal cycle): gece düşük, öğle yüksek
    fn normal(node: &NodeConfig, hour: u32, rng: &mut impl Rng) -> Readings {
        // Baz sıcaklık — orman tipine ve saate göre değişir
        let base_temp = match node.forest_type {
            ForestType::RedPine => 26.0, // Kızılçam — Akdeniz kıyısı, sıcak ve kuru
            ForestType::BlackPine => 20.0, // Karaçam — iç Anadolu, 500-2000m
            ForestType::ScotsPine => 16.0, // Sarıçam — Doğu Anadolu, kıta iklimi
            ForestType::TaurusCedar => 18.0, // Toros sediri — Toros dağları, 1000-2000m
            ForestType::SilverFir => 14.0, // Göknar — Karadeniz iç kesimleri, serin
            ForestType::OrientalSpruce => 12.0, // Doğu ladini — Doğu Karadeniz, en serin
            ForestType::Oak => 21.0,     // Meşe — Türkiye geneli, orta yükseklik
            ForestType::OrientalBeech => 15.0, // Kayın — Karadeniz, nemli ve ılıman
            ForestType::Alder => 15.0,   // Kızılağaç — riparian, su kenarı
            ForestType::Shrubland => 28.0, // Maki — Akdeniz kıyısı, en sıcak
            ForestType::Juniper => 22.0, // Ardıç — kuru iç Anadolu
            ForestType::Mixed => 20.0,   // Karma — ortalama değer
        };

        // Günlük döngü: -5°C gece, +8°C öğle
        let diurnal_offset = 8.0 * ((hour as f64 - 6.0) * std::f64::consts::PI / 12.0).sin();
        let temp = base_temp + diurnal_offset + gaussian(rng, 0.0, 0.5);

        // Nem: sıcaklıkla ters orantılı
        let humidity = (75.0 - diurnal_offset * 2.0 + gaussian(rng, 0.0, 2.0)).clamp(20.0, 95.0);

        // Duman: normal koşullarda çok düşük
        let smoke = (5.0 + gaussian(rng, 0.0, 1.5)).clamp(0.0, 15.0);

        // UV: gündüz yüksek, gece sıfır
        let uv = if (6..=18).contains(&hour) {
            let peak = 7.0 * ((hour as f64 - 6.0) * std::f64::consts::PI / 12.0).sin();
            (peak + gaussian(rng, 0.0, 0.3)).clamp(0.0, 11.0)
        } else {
            0.0
        };

        // Rüzgar: Weibull dağılımı (gerçek rüzgar istatistiklerine yakın)
        let wind_speed = weibull_wind(rng, 3.0, 1.5); // ort. ~2.7 m/s

        // Vadi etkisi — kanallaşma
        let wind_speed = if node.topology == Topology::Valley {
            wind_speed * 1.3
        } else {
            wind_speed
        };

        let wind_dir = rng.gen_range(0..360) as u16;

        Readings {
            temperature: round2(temp),
            humidity: round2(humidity),
            smoke_ppm: round2(smoke),
            uv_index: round2(uv),
            wind_speed_ms: round2(wind_speed),
            wind_dir_deg: wind_dir,
            flame_detected: false,
            co2_ppm: Some(round2(415.0 + gaussian(rng, 0.0, 5.0))),
        }
    }

    /// PRE-FIRE SENARYO
    /// Yangın öncesi koşullar: duman artıyor, nem düşük, sıcaklık yüksek
    fn prefire(node: &NodeConfig, hour: u32, rng: &mut impl Rng) -> Readings {
        let base = Self::normal(node, hour, rng);

        // Duman belirgin biçimde artıyor (100-300 PPM)
        let smoke = (150.0 + gaussian(rng, 0.0, 30.0)).clamp(80.0, 350.0);

        // Sıcaklık +5-10°C yüksek
        let temp = (base.temperature + 7.0 + gaussian(rng, 0.0, 1.0)).clamp(35.0, 50.0);

        // Nem kritik düzeyde düşük
        let humidity = (15.0 + gaussian(rng, 0.0, 3.0)).clamp(8.0, 25.0);

        // Rüzgar artar (ısınma + basınç farkı)
        let wind = (weibull_wind(rng, 6.0, 2.0)).clamp(4.0, 15.0);

        Readings {
            temperature: round2(temp),
            humidity: round2(humidity),
            smoke_ppm: round2(smoke),
            uv_index: round2(base.uv_index),
            wind_speed_ms: round2(wind),
            wind_dir_deg: base.wind_dir_deg,
            flame_detected: false, // Henüz alev yok
            co2_ppm: Some(round2(450.0 + gaussian(rng, 0.0, 20.0))),
        }
    }

    /// ACTIVE FIRE SENARYO
    /// Yangın aktif: alev tespiti, maksimum duman, ekstrem değerler
    fn active_fire(node: &NodeConfig, rng: &mut impl Rng) -> Readings {
        let smoke = (650.0 + gaussian(rng, 0.0, 50.0)).clamp(500.0, 1000.0);
        let temp = (55.0 + gaussian(rng, 0.0, 5.0)).clamp(45.0, 70.0);
        let humidity = (8.0 + gaussian(rng, 0.0, 2.0)).clamp(3.0, 15.0);
        let wind = (weibull_wind(rng, 8.0, 2.5)).clamp(5.0, 20.0);

        // Vadi etkisi aktif yangında daha kritik
        let wind = if node.topology == Topology::Valley {
            wind * 1.5
        } else {
            wind
        };

        Readings {
            temperature: round2(temp),
            humidity: round2(humidity),
            smoke_ppm: round2(smoke),
            uv_index: 10.0,
            wind_speed_ms: round2(wind),
            wind_dir_deg: rng.gen_range(0..360) as u16,
            flame_detected: true,
            co2_ppm: Some(round2(2000.0 + gaussian(rng, 0.0, 200.0))),
        }
    }

    /// SENSOR FAULT SENARYO
    /// Sensör arızası: saçma değerler, ani sıçramalar
    fn sensor_fault(rng: &mut impl Rng) -> Readings {
        // Bazı sensörler makul, bazıları saçma değer üretiyor
        Readings {
            temperature: if rng.gen_bool(0.5) {
                999.9
            } else {
                rng.gen_range(-10.0..100.0)
            },
            humidity: if rng.gen_bool(0.5) {
                -1.0
            } else {
                rng.gen_range(0.0..100.0)
            },
            smoke_ppm: if rng.gen_bool(0.3) {
                9999.0
            } else {
                rng.gen_range(0.0..50.0)
            },
            uv_index: rng.gen_range(0.0..15.0),
            wind_speed_ms: if rng.gen_bool(0.4) {
                -5.0
            } else {
                rng.gen_range(0.0..30.0)
            },
            wind_dir_deg: rng.gen_range(0..360) as u16,
            flame_detected: rng.gen_bool(0.1), // Rastgele yanıp sönüyor
            co2_ppm: None,                     // CO2 sensörü tamamen yanıt vermiyor
        }
    }
}

// -----------------------------------------------------------
// İstatistiksel Yardımcı Fonksiyonlar
// -----------------------------------------------------------

/// Gauss (normal) dağılımlı rastgele sayı
/// mean: ortalama, std_dev: standart sapma
fn gaussian(rng: &mut impl Rng, mean: f64, std_dev: f64) -> f64 {
    let normal = Normal::new(mean, std_dev).expect("Normal dağılım parametresi hatalı");
    normal.sample(rng)
}

/// Weibull dağılımlı rüzgar hızı üretimi
/// scale: ölçek parametresi (λ), shape: şekil parametresi (k)
/// Rüzgar hızı dağılımı için tipik k=2 (Rayleigh)
fn weibull_wind(rng: &mut impl Rng, scale: f64, shape: f64) -> f64 {
    let weibull = Weibull::new(scale, shape).expect("Weibull parametresi hatalı");
    weibull.sample(rng).clamp(0.0, 30.0)
}

/// İki ondalık basamağa yuvarla
fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
