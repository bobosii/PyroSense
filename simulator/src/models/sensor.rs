// ============================================================
//  PyroSense Sensör Veri Modeli
// ============================================================

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Tek bir sensör düğümünün anlık okuması
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensorReading {
    pub device_id: String,
    pub zone_id: String,
    pub timestamp: DateTime<Utc>,
    pub readings: Readings,
    pub battery_pct: u8,
    pub scenario: String,
    pub forest_type: String,
    pub fw_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Readings {
    pub temperature: f64,   // °C
    pub humidity: f64,      // %
    pub smoke_ppm: f64,     // PPM
    pub uv_index: f64,      // W/m²
    pub wind_speed_ms: f64, // m/s
    pub wind_dir_deg: u16,  // 0-360 derece
    pub flame_detected: bool,
    pub co2_ppm: Option<f64>, // Opsiyonel
}

impl SensorReading {
    pub fn new(
        device_id: &str,
        zone_id: &str,
        readings: Readings,
        forest_type: &str,
        scenario: &str,
    ) -> Self {
        Self {
            device_id: device_id.to_string(),
            zone_id: zone_id.to_string(),
            forest_type: forest_type.to_string(),
            timestamp: Utc::now(),
            readings,
            battery_pct: 100,
            scenario: scenario.to_string(),
            fw_version: "1.0.0-sim".to_string(),
        }
    }

    /// MQTT topic: pyrosense/{zone_id}/sensors
    pub fn mqtt_topic(&self) -> String {
        format!("pyrosense/{}/sensors", self.zone_id)
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).expect("Serialize hatası")
    }
}

/// Simülatör konfigürasyonu — her sensör düğümü için
#[derive(Debug, Clone)]
pub struct NodeConfig {
    pub device_id: String,
    pub zone_id: String,
    pub forest_type: ForestType,
    pub topology: Topology,
    pub base_lat: f64,
    pub base_lon: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ForestType {
    /// Kizilcam
    RedPine,
    /// Karacam
    BlackPine,
    /// Saricam
    ScotsPine,
    ///Toros Sediri (Sedir)
    TaurusCedar,
    /// Goknar
    SilverFir,
    /// Dogu Ladini
    OrientalSpruce,
    /// Mese
    Oak,
    /// Kayin
    OrientalBeech,
    /// KizilAgac
    Alder,
    /// Maki
    Shrubland,
    /// Ardic (Juniperus türleri)
    Juniper,
    /// Karma
    Mixed,
}
impl ForestType {
    pub fn as_str(&self) -> &str {
        match self {
            ForestType::RedPine => "RedPine",
            ForestType::BlackPine => "BlackPine",
            ForestType::ScotsPine => "ScotsPine",
            ForestType::TaurusCedar => "TaurusCedar",
            ForestType::SilverFir => "SilverFir",
            ForestType::OrientalSpruce => "OrientalSpruce",
            ForestType::Oak => "Oak",
            ForestType::OrientalBeech => "OrientalBeech",
            ForestType::Alder => "Alder",
            ForestType::Shrubland => "Shrubland",
            ForestType::Juniper => "Juniper",
            ForestType::Mixed => "Mixed",
        }
    }
}
#[derive(Debug, Clone, PartialEq)]
pub enum Topology {
    Valley, // Vadi — rüzgar kanalı etkisi
    Slope,  // Yamaç
    Ridge,  // Sırt
    Plain,  // Düzlük
}
