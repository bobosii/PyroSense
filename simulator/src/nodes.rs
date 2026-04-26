// ============================================================
//  PyroSense Simülatör — Sensör Düğümü Tanımları
//
//  Her zone için 3 node:
//    - Farklı topoloji (rüzgar yönü + hızının anlamlı olması için)
//    - ~2-5 km aralıklı koordinatlar (inter-zone yayılım hesabında
//      bearing/mesafe farkının gözlemlenebilir olması için)
//
//  Koordinat ofseti:
//    node_01 → bölge merkezi
//    node_02 → +0.025 lat, -0.020 lon  (~3 km K-B)
//    node_03 → -0.020 lat, +0.025 lon  (~3 km G-D)
// ============================================================

use crate::models::sensor::{ForestType, NodeConfig, Topology};

pub fn all_nodes() -> Vec<NodeConfig> {
    vec![
        // --------------------------------------------------------
        // 1. ZONE_REDPINE — Kızılçam | Muğla / Menteşe
        //    Akdeniz kıyısı, yangın hotspot bölgesi
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_redpine_01".to_string(),
            zone_id:     "zone_redpine".to_string(),
            forest_type: ForestType::RedPine,
            topology:    Topology::Slope,
            base_lat:    37.2151,
            base_lon:    28.3627,
        },
        NodeConfig {
            device_id:   "node_redpine_02".to_string(),
            zone_id:     "zone_redpine".to_string(),
            forest_type: ForestType::RedPine,
            topology:    Topology::Valley,
            base_lat:    37.2401,
            base_lon:    28.3427,
        },
        NodeConfig {
            device_id:   "node_redpine_03".to_string(),
            zone_id:     "zone_redpine".to_string(),
            forest_type: ForestType::RedPine,
            topology:    Topology::Ridge,
            base_lat:    37.1951,
            base_lon:    28.3877,
        },

        // --------------------------------------------------------
        // 2. ZONE_BLACKPINE — Karaçam | Kastamonu
        //    İç Anadolu–Karadeniz geçiş kuşağı
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_blackpine_01".to_string(),
            zone_id:     "zone_blackpine".to_string(),
            forest_type: ForestType::BlackPine,
            topology:    Topology::Ridge,
            base_lat:    41.3780,
            base_lon:    33.7743,
        },
        NodeConfig {
            device_id:   "node_blackpine_02".to_string(),
            zone_id:     "zone_blackpine".to_string(),
            forest_type: ForestType::BlackPine,
            topology:    Topology::Slope,
            base_lat:    41.4030,
            base_lon:    33.7543,
        },
        NodeConfig {
            device_id:   "node_blackpine_03".to_string(),
            zone_id:     "zone_blackpine".to_string(),
            forest_type: ForestType::BlackPine,
            topology:    Topology::Valley,
            base_lat:    41.3580,
            base_lon:    33.7993,
        },

        // --------------------------------------------------------
        // 3. ZONE_SCOTSPINE — Sarıçam | Sarıkamış / Kars
        //    Kuzeydoğu yüksek platosu, sert kış / kuru yaz
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_scotspine_01".to_string(),
            zone_id:     "zone_scotspine".to_string(),
            forest_type: ForestType::ScotsPine,
            topology:    Topology::Ridge,
            base_lat:    40.3334,
            base_lon:    42.5905,
        },
        NodeConfig {
            device_id:   "node_scotspine_02".to_string(),
            zone_id:     "zone_scotspine".to_string(),
            forest_type: ForestType::ScotsPine,
            topology:    Topology::Slope,
            base_lat:    40.3584,
            base_lon:    42.5705,
        },
        NodeConfig {
            device_id:   "node_scotspine_03".to_string(),
            zone_id:     "zone_scotspine".to_string(),
            forest_type: ForestType::ScotsPine,
            topology:    Topology::Plain,
            base_lat:    40.3134,
            base_lon:    42.6155,
        },

        // --------------------------------------------------------
        // 4. ZONE_TAURUSCEDAR — Toros Sediri | Toros Dağları / Mersin K.
        //    Endemik sedir, yüksek yamaç ve vadiler
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_tauruscedar_01".to_string(),
            zone_id:     "zone_tauruscedar".to_string(),
            forest_type: ForestType::TaurusCedar,
            topology:    Topology::Slope,
            base_lat:    37.1000,
            base_lon:    34.6000,
        },
        NodeConfig {
            device_id:   "node_tauruscedar_02".to_string(),
            zone_id:     "zone_tauruscedar".to_string(),
            forest_type: ForestType::TaurusCedar,
            topology:    Topology::Ridge,
            base_lat:    37.1250,
            base_lon:    34.5800,
        },
        NodeConfig {
            device_id:   "node_tauruscedar_03".to_string(),
            zone_id:     "zone_tauruscedar".to_string(),
            forest_type: ForestType::TaurusCedar,
            topology:    Topology::Valley,
            base_lat:    37.0800,
            base_lon:    34.6250,
        },

        // --------------------------------------------------------
        // 5. ZONE_SILVERFIR — Göknar | Bolu / Abant
        //    Karadeniz arka sırası, yüksek yağış
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_silverfir_01".to_string(),
            zone_id:     "zone_silverfir".to_string(),
            forest_type: ForestType::SilverFir,
            topology:    Topology::Slope,
            base_lat:    40.7350,
            base_lon:    31.6000,
        },
        NodeConfig {
            device_id:   "node_silverfir_02".to_string(),
            zone_id:     "zone_silverfir".to_string(),
            forest_type: ForestType::SilverFir,
            topology:    Topology::Valley,
            base_lat:    40.7600,
            base_lon:    31.5800,
        },
        NodeConfig {
            device_id:   "node_silverfir_03".to_string(),
            zone_id:     "zone_silverfir".to_string(),
            forest_type: ForestType::SilverFir,
            topology:    Topology::Ridge,
            base_lat:    40.7150,
            base_lon:    31.6250,
        },

        // --------------------------------------------------------
        // 6. ZONE_ORIENTALSPRUCE — Doğu Ladini | Rize / Artvin
        //    Doğu Karadeniz yağışlı kuşak, dik yamaçlar
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_orientalspruce_01".to_string(),
            zone_id:     "zone_orientalspruce".to_string(),
            forest_type: ForestType::OrientalSpruce,
            topology:    Topology::Slope,
            base_lat:    41.0500,
            base_lon:    40.5000,
        },
        NodeConfig {
            device_id:   "node_orientalspruce_02".to_string(),
            zone_id:     "zone_orientalspruce".to_string(),
            forest_type: ForestType::OrientalSpruce,
            topology:    Topology::Valley,
            base_lat:    41.0750,
            base_lon:    40.4800,
        },
        NodeConfig {
            device_id:   "node_orientalspruce_03".to_string(),
            zone_id:     "zone_orientalspruce".to_string(),
            forest_type: ForestType::OrientalSpruce,
            topology:    Topology::Ridge,
            base_lat:    41.0300,
            base_lon:    40.5250,
        },

        // --------------------------------------------------------
        // 7. ZONE_OAK — Meşe | Kızılcahamam / Ankara
        //    İç Anadolu–Karadeniz geçişi, vadi ve yamaç mozaiği
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_oak_01".to_string(),
            zone_id:     "zone_oak".to_string(),
            forest_type: ForestType::Oak,
            topology:    Topology::Valley,
            base_lat:    40.4697,
            base_lon:    32.6558,
        },
        NodeConfig {
            device_id:   "node_oak_02".to_string(),
            zone_id:     "zone_oak".to_string(),
            forest_type: ForestType::Oak,
            topology:    Topology::Slope,
            base_lat:    40.4947,
            base_lon:    32.6358,
        },
        NodeConfig {
            device_id:   "node_oak_03".to_string(),
            zone_id:     "zone_oak".to_string(),
            forest_type: ForestType::Oak,
            topology:    Topology::Plain,
            base_lat:    40.4497,
            base_lon:    32.6808,
        },

        // --------------------------------------------------------
        // 8. ZONE_ORIENTALBEECH — Doğu Kayını | Karabük / Yenice
        //    Batı Karadeniz, ıslak kayın ormanı
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_orientalbeech_01".to_string(),
            zone_id:     "zone_orientalbeech".to_string(),
            forest_type: ForestType::OrientalBeech,
            topology:    Topology::Slope,
            base_lat:    41.2000,
            base_lon:    32.6000,
        },
        NodeConfig {
            device_id:   "node_orientalbeech_02".to_string(),
            zone_id:     "zone_orientalbeech".to_string(),
            forest_type: ForestType::OrientalBeech,
            topology:    Topology::Ridge,
            base_lat:    41.2250,
            base_lon:    32.5800,
        },
        NodeConfig {
            device_id:   "node_orientalbeech_03".to_string(),
            zone_id:     "zone_orientalbeech".to_string(),
            forest_type: ForestType::OrientalBeech,
            topology:    Topology::Valley,
            base_lat:    41.1800,
            base_lon:    32.6250,
        },

        // --------------------------------------------------------
        // 9. ZONE_ALDER — Kızılağaç | Göksu Deltası / Mersin
        //    Sulak alan kenarı, düz delta, iki vadi ağzı
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_alder_01".to_string(),
            zone_id:     "zone_alder".to_string(),
            forest_type: ForestType::Alder,
            topology:    Topology::Valley,
            base_lat:    36.3000,
            base_lon:    33.9833,
        },
        NodeConfig {
            device_id:   "node_alder_02".to_string(),
            zone_id:     "zone_alder".to_string(),
            forest_type: ForestType::Alder,
            topology:    Topology::Plain,
            base_lat:    36.3250,
            base_lon:    33.9633,
        },
        NodeConfig {
            device_id:   "node_alder_03".to_string(),
            zone_id:     "zone_alder".to_string(),
            forest_type: ForestType::Alder,
            topology:    Topology::Valley,
            base_lat:    36.2800,
            base_lon:    34.0083,
        },

        // --------------------------------------------------------
        // 10. ZONE_SHRUBLAND — Maki | Antalya Kıyısı
        //     Akdeniz kuru çalılık, yaz kuraklığında yüksek risk
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_shrubland_01".to_string(),
            zone_id:     "zone_shrubland".to_string(),
            forest_type: ForestType::Shrubland,
            topology:    Topology::Slope,
            base_lat:    36.8841,
            base_lon:    30.7056,
        },
        NodeConfig {
            device_id:   "node_shrubland_02".to_string(),
            zone_id:     "zone_shrubland".to_string(),
            forest_type: ForestType::Shrubland,
            topology:    Topology::Ridge,
            base_lat:    36.9091,
            base_lon:    30.6856,
        },
        NodeConfig {
            device_id:   "node_shrubland_03".to_string(),
            zone_id:     "zone_shrubland".to_string(),
            forest_type: ForestType::Shrubland,
            topology:    Topology::Valley,
            base_lat:    36.8641,
            base_lon:    30.7306,
        },

        // --------------------------------------------------------
        // 11. ZONE_JUNIPER — Ardıç | Beyşehir / Konya
        //     İç Anadolu yarı-kurak, geniş düzlük ve yamaç
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_juniper_01".to_string(),
            zone_id:     "zone_juniper".to_string(),
            forest_type: ForestType::Juniper,
            topology:    Topology::Plain,
            base_lat:    37.6750,
            base_lon:    31.7250,
        },
        NodeConfig {
            device_id:   "node_juniper_02".to_string(),
            zone_id:     "zone_juniper".to_string(),
            forest_type: ForestType::Juniper,
            topology:    Topology::Slope,
            base_lat:    37.7000,
            base_lon:    31.7050,
        },
        NodeConfig {
            device_id:   "node_juniper_03".to_string(),
            zone_id:     "zone_juniper".to_string(),
            forest_type: ForestType::Juniper,
            topology:    Topology::Plain,
            base_lat:    37.6550,
            base_lon:    31.7500,
        },

        // --------------------------------------------------------
        // 12. ZONE_MIXED — Karma | Belgrad Ormanı / İstanbul
        //     Kentsel-periferik sınır, karma topoloji
        // --------------------------------------------------------
        NodeConfig {
            device_id:   "node_mixed_01".to_string(),
            zone_id:     "zone_mixed".to_string(),
            forest_type: ForestType::Mixed,
            topology:    Topology::Valley,
            base_lat:    41.1944,
            base_lon:    28.9514,
        },
        NodeConfig {
            device_id:   "node_mixed_02".to_string(),
            zone_id:     "zone_mixed".to_string(),
            forest_type: ForestType::Mixed,
            topology:    Topology::Slope,
            base_lat:    41.2194,
            base_lon:    28.9314,
        },
        NodeConfig {
            device_id:   "node_mixed_03".to_string(),
            zone_id:     "zone_mixed".to_string(),
            forest_type: ForestType::Mixed,
            topology:    Topology::Ridge,
            base_lat:    41.1744,
            base_lon:    28.9764,
        },
    ]
}
