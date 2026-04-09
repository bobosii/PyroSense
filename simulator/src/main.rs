// ============================================================
//  PyroSense Simülatör — Ana Giriş Noktası
//
//  Çalıştırma:
//    cargo run
//
//  Senaryo değiştirme (HTTP API):
//    curl -X POST http://localhost:8090/scenario \
//         -H "Content-Type: application/json" \
//         -d '{"scenario": "prefire", "zone_id": "zone_a"}'
//
//  Tüm senaryo geçişleri:
//    normal | prefire | activefire | sensorFault
// ============================================================

mod models;
mod mqtt;
mod scenarios;

use models::sensor::{ForestType, NodeConfig, SensorReading, Topology};
use mqtt::publisher::MqttPublisher;
use scenarios::{Scenario, SensorPhysics};

use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
    time::Duration,
};
use tokio::time::interval;
use tracing::info;

// -----------------------------------------------------------
// Paylaşılan Durum — senaryo durumları thread-safe
// -----------------------------------------------------------
type ScenarioMap = Arc<RwLock<HashMap<String, Scenario>>>;

// -----------------------------------------------------------
// HTTP API — Senaryo Değiştirme
// -----------------------------------------------------------
#[derive(Deserialize)]
struct ScenarioRequest {
    scenario: String,
    zone_id: String,
}

#[derive(Serialize)]
struct ScenarioResponse {
    success: bool,
    message: String,
}

async fn set_scenario(
    State(scenarios): State<ScenarioMap>,
    Json(req): Json<ScenarioRequest>,
) -> Json<ScenarioResponse> {
    let new_scenario = match req.scenario.as_str() {
        "normal" => Scenario::Normal,
        "prefire" => Scenario::PreFire,
        "activefire" => Scenario::ActiveFire,
        "sensorFault" => Scenario::SensorFault,
        unknown => {
            return Json(ScenarioResponse {
                success: false,
                message: format!("Bilinmeyen senaryo: {}", unknown),
            })
        }
    };

    let mut map = scenarios.write().unwrap();
    map.insert(req.zone_id.clone(), new_scenario);

    Json(ScenarioResponse {
        success: true,
        message: format!(
            "zone_id={} → {} senaryosuna geçildi",
            req.zone_id, req.scenario
        ),
    })
}

// -----------------------------------------------------------
// Ana Fonksiyon
// -----------------------------------------------------------
#[tokio::main]
async fn main() {
    // Loglama başlat
    tracing_subscriber::fmt()
        .with_target(false)
        .compact()
        .init();

    // .env dosyasından konfigürasyon
    let _ = dotenv::dotenv();
    let mqtt_host = std::env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".to_string());
    let mqtt_port: u16 = std::env::var("MQTT_PORT")
        .unwrap_or_else(|_| "1883".to_string())
        .parse()
        .unwrap_or(1883);
    let publish_interval_secs: u64 = std::env::var("PUBLISH_INTERVAL_SECS")
        .unwrap_or_else(|_| "30".to_string())
        .parse()
        .unwrap_or(30);

    info!("PyroSense Simülatörü başlatılıyor...");
    info!(
        "MQTT: {}:{} | Yayın aralığı: {}s",
        mqtt_host, mqtt_port, publish_interval_secs
    );

    // Simüle edilecek sensör düğümleri
    let nodes = vec![
        NodeConfig {
            device_id: "node_a_01".to_string(),
            zone_id: "zone_a".to_string(),
            forest_type: ForestType::RedPine,
            topology: Topology::Slope,
            base_lat: 36.8969,
            base_lon: 30.7133,
        },
        NodeConfig {
            device_id: "node_b_01".to_string(),
            zone_id: "zone_b".to_string(),
            forest_type: ForestType::Oak,
            topology: Topology::Valley,
            base_lat: 36.8800,
            base_lon: 30.7000,
        },
        NodeConfig {
            device_id: "node_c_01".to_string(),
            zone_id: "zone_c".to_string(),
            forest_type: ForestType::Mixed,
            topology: Topology::Ridge,
            base_lat: 36.9100,
            base_lon: 30.7300,
        },
    ];

    // Başlangıç senaryoları: hepsi Normal
    let scenarios: ScenarioMap = Arc::new(RwLock::new(HashMap::new()));
    {
        let mut map = scenarios.write().unwrap();
        for node in &nodes {
            map.insert(node.zone_id.clone(), Scenario::Normal);
        }
    }

    // MQTT yayıncısını başlat
    let publisher =
        Arc::new(MqttPublisher::new(&mqtt_host, mqtt_port, "pyrosense-simulator").await);

    // HTTP API'yi arka planda başlat (senaryo değiştirme)
    let api_scenarios = scenarios.clone();
    tokio::spawn(async move {
        let app = Router::new()
            .route("/scenario", post(set_scenario))
            .with_state(api_scenarios);

        let listener = tokio::net::TcpListener::bind("0.0.0.0:8090").await.unwrap();
        info!("Senaryo API: http://localhost:8090/scenario");
        axum::serve(listener, app).await.unwrap();
    });

    // Ana döngü: her PUBLISH_INTERVAL_SECS saniyede bir veri üret ve yayınla
    let mut ticker = interval(Duration::from_secs(publish_interval_secs));

    info!("Simülasyon başladı. {} düğüm aktif.", nodes.len());

    loop {
        ticker.tick().await;

        let scenario_map = scenarios.read().unwrap();

        for node in &nodes {
            let scenario = scenario_map.get(&node.zone_id).unwrap_or(&Scenario::Normal);

            let readings = SensorPhysics::generate(node, scenario);
            let reading = SensorReading::new(
                &node.device_id,
                &node.zone_id,
                readings,
                node.forest_type.as_str(),
                node.topology.as_str(),
                scenario.name(),
            );

            let topic = reading.mqtt_topic();
            let payload = reading.to_json();

            let pub_clone = publisher.clone();
            let topic_clone = topic.clone();
            let payload_clone = payload.clone();

            tokio::spawn(async move {
                pub_clone.publish(&topic_clone, &payload_clone).await;
            });
        }
    }
}
