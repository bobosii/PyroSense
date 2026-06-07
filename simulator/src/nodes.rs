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
//
//  prevailing_wind_dir: yaz mevsimi hakim rüzgar yönü (rüzgarın geldiği yön, 0-359°)
//  wind_dir_variance:   ±std_dev (derece) — düşük = tutarlı, yüksek = değişken
//
//  Kaynak: MGM Türkiye Rüzgar Atlası, ECMWF ERA5 yaz ortalamaları,
//          Türkiye Yangın Meteorolojisi Rehberi (OGM 2019)
// ============================================================

use crate::models::sensor::{ForestType, NodeConfig, Topology};

pub fn all_nodes() -> Vec<NodeConfig> {
    vec![
        // --------------------------------------------------------
        // 1. ZONE_REDPINE — Kızılçam | Muğla / Menteşe
        //    Akdeniz kıyısı, yangın hotspot bölgesi
        //    Hakim rüzgar: Lodos (GB, 220°) — yaz yangın mevsiminin birincil rüzgarı
        //    Muğla/Menteşe havzasında GB-B yönlü rüzgar hakimdir; Lodos kuru ve sıcak gelir.
        //    variance=35: kıyı topoğrafyası kanallaştırıcı etki yapar, yön tutarlı.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_redpine_01".to_string(),
            zone_id: "zone_redpine".to_string(),
            forest_type: ForestType::RedPine,
            topology: Topology::Slope,
            base_lat: 37.2151,
            base_lon: 28.3627,
            prevailing_wind_dir: 220,
            wind_dir_variance: 35,
        },
        NodeConfig {
            device_id: "node_redpine_02".to_string(),
            zone_id: "zone_redpine".to_string(),
            forest_type: ForestType::RedPine,
            topology: Topology::Valley,
            base_lat: 37.2401,
            base_lon: 28.3427,
            prevailing_wind_dir: 220,
            wind_dir_variance: 35,
        },
        NodeConfig {
            device_id: "node_redpine_03".to_string(),
            zone_id: "zone_redpine".to_string(),
            forest_type: ForestType::RedPine,
            topology: Topology::Ridge,
            base_lat: 37.1951,
            base_lon: 28.3877,
            prevailing_wind_dir: 220,
            wind_dir_variance: 35,
        },
        // --------------------------------------------------------
        // 2. ZONE_BLACKPINE — Karaçam | Kastamonu
        //    İç Anadolu–Karadeniz geçiş kuşağı
        //    Hakim rüzgar: Karadeniz'den gelen K-KB (340°) yönlü rüzgar.
        //    Kastamonu'da yaz aylarında K ve KB'den esen ılık-nemli rüzgarlar hakimdir;
        //    Güney rüzgarı (fön) dağ geçitlerinde oluştuğunda tehlikeli olabilir.
        //    variance=50: iç kesim, yön daha değişken.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_blackpine_01".to_string(),
            zone_id: "zone_blackpine".to_string(),
            forest_type: ForestType::BlackPine,
            topology: Topology::Ridge,
            base_lat: 41.3780,
            base_lon: 33.7743,
            prevailing_wind_dir: 340,
            wind_dir_variance: 50,
        },
        NodeConfig {
            device_id: "node_blackpine_02".to_string(),
            zone_id: "zone_blackpine".to_string(),
            forest_type: ForestType::BlackPine,
            topology: Topology::Slope,
            base_lat: 41.4030,
            base_lon: 33.7543,
            prevailing_wind_dir: 340,
            wind_dir_variance: 50,
        },
        NodeConfig {
            device_id: "node_blackpine_03".to_string(),
            zone_id: "zone_blackpine".to_string(),
            forest_type: ForestType::BlackPine,
            topology: Topology::Valley,
            base_lat: 41.3580,
            base_lon: 33.7993,
            prevailing_wind_dir: 340,
            wind_dir_variance: 50,
        },
        // --------------------------------------------------------
        // 3. ZONE_SCOTSPINE — Sarıçam | Sarıkamış / Kars
        //    Hakim rüzgar: Kuzeydoğu (50°) — Kars platosunda K-KD yönlü sert rüzgar
        //    (Sibirya kökenli kıta rüzgarı). Yaz aylarında yön biraz güneye döner
        //    ama genel eğilim KD'dir. Çok sert esebilir.
        //    variance=45: açık plato, yön tutarlı ama değişken olabilir.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_scotspine_01".to_string(),
            zone_id: "zone_scotspine".to_string(),
            forest_type: ForestType::ScotsPine,
            topology: Topology::Ridge,
            base_lat: 40.3334,
            base_lon: 42.5905,
            prevailing_wind_dir: 50,
            wind_dir_variance: 45,
        },
        NodeConfig {
            device_id: "node_scotspine_02".to_string(),
            zone_id: "zone_scotspine".to_string(),
            forest_type: ForestType::ScotsPine,
            topology: Topology::Slope,
            base_lat: 40.3584,
            base_lon: 42.5705,
            prevailing_wind_dir: 50,
            wind_dir_variance: 45,
        },
        NodeConfig {
            device_id: "node_scotspine_03".to_string(),
            zone_id: "zone_scotspine".to_string(),
            forest_type: ForestType::ScotsPine,
            topology: Topology::Plain,
            base_lat: 40.3134,
            base_lon: 42.6155,
            prevailing_wind_dir: 50,
            wind_dir_variance: 45,
        },
        // --------------------------------------------------------
        // 4. ZONE_TAURUSCEDAR — Toros Sediri | Çamlıyayla / Mersin
        //    Hakim rüzgar: Güney-Güneybatı (195°) — Akdeniz kaynaklı.
        //    Toros yamaçlarında güney ve GB yönlü Akdeniz rüzgarları hakimdir.
        //    Bu rüzgar yaz kuraklığıyla birleşince yamaçlarda yangın riskini
        //    dramatik biçimde artırır (baca etkisi).
        //    variance=40: dağ geçitleri yönü biraz kanallar.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_tauruscedar_01".to_string(),
            zone_id: "zone_tauruscedar".to_string(),
            forest_type: ForestType::TaurusCedar,
            topology: Topology::Slope,
            base_lat: 37.2800,
            base_lon: 34.6200,
            prevailing_wind_dir: 195,
            wind_dir_variance: 40,
        },
        NodeConfig {
            device_id: "node_tauruscedar_02".to_string(),
            zone_id: "zone_tauruscedar".to_string(),
            forest_type: ForestType::TaurusCedar,
            topology: Topology::Ridge,
            base_lat: 37.3050,
            base_lon: 34.6000,
            prevailing_wind_dir: 195,
            wind_dir_variance: 40,
        },
        NodeConfig {
            device_id: "node_tauruscedar_03".to_string(),
            zone_id: "zone_tauruscedar".to_string(),
            forest_type: ForestType::TaurusCedar,
            topology: Topology::Valley,
            base_lat: 37.2550,
            base_lon: 34.6450,
            prevailing_wind_dir: 195,
            wind_dir_variance: 40,
        },
        // --------------------------------------------------------
        // 5. ZONE_SILVERFIR — Göknar | Bolu / Abant
        //    Hakim rüzgar: Batı-Kuzeybatı (290°) — Karadeniz havzası etki alanı.
        //    Bolu-Abant bölgesinde yaz aylarında B ve KB'den gelen ılık-nemli
        //    rüzgarlar hakimdir. Güney-Doğu'dan gelen fön rüzgarı nadir ama mümkün.
        //    variance=55: orta yükseklik dağ alanı, yön değişkenliği orta.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_silverfir_01".to_string(),
            zone_id: "zone_silverfir".to_string(),
            forest_type: ForestType::SilverFir,
            topology: Topology::Slope,
            base_lat: 40.7350,
            base_lon: 31.6000,
            prevailing_wind_dir: 290,
            wind_dir_variance: 55,
        },
        NodeConfig {
            device_id: "node_silverfir_02".to_string(),
            zone_id: "zone_silverfir".to_string(),
            forest_type: ForestType::SilverFir,
            topology: Topology::Valley,
            base_lat: 40.7600,
            base_lon: 31.5800,
            prevailing_wind_dir: 290,
            wind_dir_variance: 55,
        },
        NodeConfig {
            device_id: "node_silverfir_03".to_string(),
            zone_id: "zone_silverfir".to_string(),
            forest_type: ForestType::SilverFir,
            topology: Topology::Ridge,
            base_lat: 40.7150,
            base_lon: 31.6250,
            prevailing_wind_dir: 290,
            wind_dir_variance: 55,
        },
        // --------------------------------------------------------
        // 6. ZONE_ORIENTALSPRUCE — Doğu Ladini | Rize / Artvin
        //    Hakim rüzgar: Kuzey-Kuzeydoğu (20°) — Karadeniz rüzgarı.
        //    Doğu Karadeniz kıyısında K ve KKD'den gelen nemli deniz rüzgarları
        //    yıl boyu hakimdir. Bu rüzgar nem getirdiğinden yangın riski düşüktür;
        //    yönü coğrafi gerçeklikle örtüşmeli.
        //    variance=30: kıyı topoğrafyası yönü sabitleyen etki yapar.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_orientalspruce_01".to_string(),
            zone_id: "zone_orientalspruce".to_string(),
            forest_type: ForestType::OrientalSpruce,
            topology: Topology::Slope,
            base_lat: 41.0500,
            base_lon: 40.5000,
            prevailing_wind_dir: 20,
            wind_dir_variance: 30,
        },
        NodeConfig {
            device_id: "node_orientalspruce_02".to_string(),
            zone_id: "zone_orientalspruce".to_string(),
            forest_type: ForestType::OrientalSpruce,
            topology: Topology::Valley,
            base_lat: 41.0750,
            base_lon: 40.4800,
            prevailing_wind_dir: 20,
            wind_dir_variance: 30,
        },
        NodeConfig {
            device_id: "node_orientalspruce_03".to_string(),
            zone_id: "zone_orientalspruce".to_string(),
            forest_type: ForestType::OrientalSpruce,
            topology: Topology::Ridge,
            base_lat: 41.0300,
            base_lon: 40.5250,
            prevailing_wind_dir: 20,
            wind_dir_variance: 30,
        },
        // --------------------------------------------------------
        // 7. ZONE_OAK — Meşe | Kızılcahamam / Ankara
        //    Hakim rüzgar: Kuzey-Kuzeybatı (330°) — Ankara havzası etkisi.
        //    İç Anadolu platosunda yaz aylarında K ve KB'den gelen rüzgarlar
        //    nispeten tutarlıdır; termik kökenli rüzgarlar da görülebilir.
        //    variance=60: iç Anadolu, termik rüzgar yön değişkenliği yüksek.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_oak_01".to_string(),
            zone_id: "zone_oak".to_string(),
            forest_type: ForestType::Oak,
            topology: Topology::Valley,
            base_lat: 40.4697,
            base_lon: 32.6558,
            prevailing_wind_dir: 330,
            wind_dir_variance: 60,
        },
        NodeConfig {
            device_id: "node_oak_02".to_string(),
            zone_id: "zone_oak".to_string(),
            forest_type: ForestType::Oak,
            topology: Topology::Slope,
            base_lat: 40.4947,
            base_lon: 32.6358,
            prevailing_wind_dir: 330,
            wind_dir_variance: 60,
        },
        NodeConfig {
            device_id: "node_oak_03".to_string(),
            zone_id: "zone_oak".to_string(),
            forest_type: ForestType::Oak,
            topology: Topology::Plain,
            base_lat: 40.4497,
            base_lon: 32.6808,
            prevailing_wind_dir: 330,
            wind_dir_variance: 60,
        },
        // --------------------------------------------------------
        // 8. ZONE_ORIENTALBEECH — Doğu Kayını | Karabük / Yenice
        //    Hakim rüzgar: Kuzey (355°) — Batı Karadeniz havzası.
        //    Karabük-Yenice bölgesinde K ve KKB rüzgarları hakimdir.
        //    Yüksek nem ortamı; yangın riski normalde düşük.
        //    variance=45: dağ-kıyı geçiş hattı, orta değişkenlik.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_orientalbeech_01".to_string(),
            zone_id: "zone_orientalbeech".to_string(),
            forest_type: ForestType::OrientalBeech,
            topology: Topology::Slope,
            base_lat: 41.2000,
            base_lon: 32.6000,
            prevailing_wind_dir: 355,
            wind_dir_variance: 45,
        },
        NodeConfig {
            device_id: "node_orientalbeech_02".to_string(),
            zone_id: "zone_orientalbeech".to_string(),
            forest_type: ForestType::OrientalBeech,
            topology: Topology::Ridge,
            base_lat: 41.2250,
            base_lon: 32.5800,
            prevailing_wind_dir: 355,
            wind_dir_variance: 45,
        },
        NodeConfig {
            device_id: "node_orientalbeech_03".to_string(),
            zone_id: "zone_orientalbeech".to_string(),
            forest_type: ForestType::OrientalBeech,
            topology: Topology::Valley,
            base_lat: 41.1800,
            base_lon: 32.6250,
            prevailing_wind_dir: 355,
            wind_dir_variance: 45,
        },
        // --------------------------------------------------------
        // 9. ZONE_ALDER — Kızılağaç | Göksu Deltası / Mersin
        //    Hakim rüzgar: Güney-Güneybatı (185°) — Akdeniz deniz meltemi.
        //    Göksu Deltası ve Mersin kıyısında G-GB yönlü meltemi yaz boyu hakimdir.
        //    Kızılağaç riparian bir tür; su kenarında olduğundan nem yüksek.
        //    variance=30: kıyı meltemi yön tutarlılığı yüksek.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_alder_01".to_string(),
            zone_id: "zone_alder".to_string(),
            forest_type: ForestType::Alder,
            topology: Topology::Valley,
            base_lat: 36.3000,
            base_lon: 33.9833,
            prevailing_wind_dir: 185,
            wind_dir_variance: 30,
        },
        NodeConfig {
            device_id: "node_alder_02".to_string(),
            zone_id: "zone_alder".to_string(),
            forest_type: ForestType::Alder,
            topology: Topology::Plain,
            base_lat: 36.3250,
            base_lon: 33.9633,
            prevailing_wind_dir: 185,
            wind_dir_variance: 30,
        },
        NodeConfig {
            device_id: "node_alder_03".to_string(),
            zone_id: "zone_alder".to_string(),
            forest_type: ForestType::Alder,
            topology: Topology::Valley,
            base_lat: 36.2800,
            base_lon: 34.0083,
            prevailing_wind_dir: 185,
            wind_dir_variance: 30,
        },
        // --------------------------------------------------------
        // 10. ZONE_SHRUBLAND — Maki | Kemer / Antalya
        //    Hakim rüzgar: Batı-Güneybatı (240°) — Antalya meltemi + Lodos.
        //    Kemer kıyısında B ve GB yönlü meltemi hakimdir; zaman zaman
        //    güçlü Lodos (225-240°) akar. En yüksek yangın tehlikesi bu rüzgarla.
        //    variance=30: kıyı meltemi kanallaşması, yön çok tutarlı.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_shrubland_01".to_string(),
            zone_id: "zone_shrubland".to_string(),
            forest_type: ForestType::Shrubland,
            topology: Topology::Slope,
            base_lat: 36.5500,
            base_lon: 30.5500,
            prevailing_wind_dir: 240,
            wind_dir_variance: 30,
        },
        NodeConfig {
            device_id: "node_shrubland_02".to_string(),
            zone_id: "zone_shrubland".to_string(),
            forest_type: ForestType::Shrubland,
            topology: Topology::Ridge,
            base_lat: 36.5750,
            base_lon: 30.5300,
            prevailing_wind_dir: 240,
            wind_dir_variance: 30,
        },
        NodeConfig {
            device_id: "node_shrubland_03".to_string(),
            zone_id: "zone_shrubland".to_string(),
            forest_type: ForestType::Shrubland,
            topology: Topology::Valley,
            base_lat: 36.5250,
            base_lon: 30.5750,
            prevailing_wind_dir: 240,
            wind_dir_variance: 30,
        },
        // --------------------------------------------------------
        // 11. ZONE_JUNIPER — Ardıç | Beyşehir / Konya
        //    Hakim rüzgar: Kuzey-Kuzeybatı (320°) — İç Anadolu platosundan esen
        //    termik kökenli rüzgar. Beyşehir Gölü üzerinden gelen serin KB rüzgarı.
        //    variance=65: iç Anadolu açık düzlük; termik değişkenlik en yüksek.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_juniper_01".to_string(),
            zone_id: "zone_juniper".to_string(),
            forest_type: ForestType::Juniper,
            topology: Topology::Plain,
            base_lat: 37.6750,
            base_lon: 31.7250,
            prevailing_wind_dir: 320,
            wind_dir_variance: 65,
        },
        NodeConfig {
            device_id: "node_juniper_02".to_string(),
            zone_id: "zone_juniper".to_string(),
            forest_type: ForestType::Juniper,
            topology: Topology::Slope,
            base_lat: 37.7000,
            base_lon: 31.7050,
            prevailing_wind_dir: 320,
            wind_dir_variance: 65,
        },
        NodeConfig {
            device_id: "node_juniper_03".to_string(),
            zone_id: "zone_juniper".to_string(),
            forest_type: ForestType::Juniper,
            topology: Topology::Plain,
            base_lat: 37.6550,
            base_lon: 31.7500,
            prevailing_wind_dir: 320,
            wind_dir_variance: 65,
        },
        // --------------------------------------------------------
        // 12. ZONE_MIXED — Karma | Belgrad Ormanı / İstanbul
        //    Hakim rüzgar: Kuzey-Kuzeydoğu (25°) — İstanbul Poyraz.
        //    Belgrad Ormanı İstanbul'un kuzeyinde; Karadeniz'den gelen Poyraz
        //    (KKD, ~25-45°) yaz mevsiminin baskın rüzgarıdır. Serin ve nemli gelir.
        //    variance=40: Boğaz yakınında kanal etkisi yönü stabilize eder.
        // --------------------------------------------------------
        NodeConfig {
            device_id: "node_mixed_01".to_string(),
            zone_id: "zone_mixed".to_string(),
            forest_type: ForestType::Mixed,
            topology: Topology::Valley,
            base_lat: 41.1944,
            base_lon: 28.9514,
            prevailing_wind_dir: 25,
            wind_dir_variance: 40,
        },
        NodeConfig {
            device_id: "node_mixed_02".to_string(),
            zone_id: "zone_mixed".to_string(),
            forest_type: ForestType::Mixed,
            topology: Topology::Slope,
            base_lat: 41.2194,
            base_lon: 28.9314,
            prevailing_wind_dir: 25,
            wind_dir_variance: 40,
        },
        NodeConfig {
            device_id: "node_mixed_03".to_string(),
            zone_id: "zone_mixed".to_string(),
            forest_type: ForestType::Mixed,
            topology: Topology::Ridge,
            base_lat: 41.1744,
            base_lon: 28.9764,
            prevailing_wind_dir: 25,
            wind_dir_variance: 40,
        },
    ]
}
