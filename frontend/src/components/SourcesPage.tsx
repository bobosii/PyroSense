import { useEffect, useState } from "react";

// ── Tipler ─────────────────────────────────────────────────────────────────

interface ServiceHealth {
    ok: boolean;
    detail?: string;
}
interface HealthResult {
    postgres: ServiceHealth;
    fuseki: ServiceHealth;
    mqtt: ServiceHealth;
}

// ── Statik veri ────────────────────────────────────────────────────────────

const RISK_FLAGS = [
    {
        rule: "FLAME_DETECTED",
        label: "Alev Tespiti",
        weight: 65,
        condition: "flame_detected = true",
        desc: "Sensörün alev dedektörü doğrudan ateş varlığını raporladığında tetiklenir. En yüksek ağırlıklı kural; tek başına HIGH seviyeye ulaştırabilir.",
        color: "var(--risk-extreme)",
    },
    {
        rule: "SMOKE_ALARM",
        label: "Duman Alarmı",
        weight: 35,
        condition: "smoke_ppm > eşik (orman tipine göre)",
        desc: "Duman yoğunluğu orman tipine özel eşiği aştığında tetiklenir. Kızılçam için eşik Göknar'a göre daha düşüktür.",
        color: "var(--risk-extreme)",
    },
    {
        rule: "SLOPE_FIRE_SPREAD_CRITICAL",
        label: "Yamaç Yayılım Kritik",
        weight: 30,
        condition: "topo=slope AND rüzgar > 5 m/s AND nem < %30 AND sıcaklık > 30°C",
        desc: "Yamaç topografyasında rüzgar, düşük nem ve yüksek sıcaklık birleşiminde yangın hızla yukarı tırmanır. Yalnızca yamaç bölgelerde aktif.",
        color: "var(--risk-high)",
    },
    {
        rule: "EARLY_FIRE_SIGNAL",
        label: "Erken Yangın Sinyali",
        weight: 25,
        condition: "co2 > eşik AND smoke_ppm > erken eşik",
        desc: "Görünür alev olmadan CO₂ ve duman birlikte yükseliyorsa oluşan öncü uyarı. Yangının gizli faz tespitini sağlar.",
        color: "var(--risk-high)",
    },
    {
        rule: "DOWNWIND_SPREAD_THREAT",
        label: "Rüzgar Altı Yayılım Tehdidi",
        weight: 25,
        condition: "rüzgar > yayılım eşiği AND sıcaklık > yayılım sıcaklığı",
        desc: "Güçlü rüzgar ve yüksek sıcaklık kombinasyonu, yangının rüzgar yönünde yayılma riskini ifade eder.",
        color: "var(--risk-high)",
    },
    {
        rule: "HIGH_SPREAD_RISK",
        label: "Yüksek Yayılım Riski",
        weight: 20,
        condition: "rüzgar > yayılım eşiği AND sıcaklık > yayılım sıcaklığı",
        desc: "Rüzgar hızı ve sıcaklık eşikleri aşıldığında ateşin yayılma potansiyelinin yüksek olduğunu işaret eder.",
        color: "var(--risk-moderate)",
    },
    {
        rule: "HIGH_DROUGHT_RISK",
        label: "Yüksek Kuraklık Riski",
        weight: 20,
        condition: "sıcaklık > kuraklık eşiği AND nem < kuraklık nemi",
        desc: "Open-Meteo'dan alınan 30 günlük yağış verisiyle dinamik olarak ayarlanan eşikler. Kuraklık dönemlerinde eşikler düşer, risk artar.",
        color: "var(--risk-moderate)",
    },
    {
        rule: "VALLEY_WIND_AMPLIFICATION",
        label: "Vadi Rüzgar Etkisi",
        weight: 15,
        condition: "topo=valley AND rüzgar > 6 m/s AND sıcaklık > 25°C",
        desc: "Vadiler rüzgarı kanalize ederek hızlandırır. Bu etki yangın davranışını öngörülemez kılar. Yalnızca vadi bölgelerde aktif.",
        color: "var(--risk-moderate)",
    },
    {
        rule: "RIDGE_WIND_EXPOSURE",
        label: "Sırt Rüzgar Açıklığı",
        weight: 10,
        condition: "topo=ridge AND rüzgar > 8 m/s",
        desc: "Sırtlar rüzgara en açık topografyadır. Sürekli rüzgar maruziyeti yangın yayılımını hızlandırır. Yalnızca sırt bölgelerde aktif.",
        color: "var(--secondary)",
    },
];

const FOREST_TYPES = [
    {
        id: "zone_redpine",
        name: "Kızılçam",
        location: "Muğla/Menteşe",
        risk: "Çok Yüksek",
        riskColor: "var(--risk-extreme)",
        note: "Reçine içeriği yüksek, hızlı tutuşur",
    },
    {
        id: "zone_shrubland",
        name: "Maki",
        location: "Antalya Kıyısı",
        risk: "Çok Yüksek",
        riskColor: "var(--risk-extreme)",
        note: "Sık, alçak yapı — yüzey yangını için ideal yakıt",
    },
    {
        id: "zone_tauruscedar",
        name: "Toros Sediri",
        location: "Toros Dağları",
        risk: "Yüksek",
        riskColor: "var(--risk-high)",
        note: "Yamaç topografyası, düşük nem toleransı",
    },
    {
        id: "zone_blackpine",
        name: "Karaçam",
        location: "Kastamonu",
        risk: "Yüksek",
        riskColor: "var(--risk-high)",
        note: "Sırt konumu, rüzgar maruziyeti",
    },
    {
        id: "zone_scotspine",
        name: "Sarıçam",
        location: "Sarıkamış/Kars",
        risk: "Yüksek",
        riskColor: "var(--risk-high)",
        note: "Sırt topografyası, sürekli rüzgar",
    },
    {
        id: "zone_juniper",
        name: "Ardıç",
        location: "Beyşehir/Konya",
        risk: "Orta",
        riskColor: "var(--risk-moderate)",
        note: "Ova topografyası, düşük nem hassasiyeti",
    },
    {
        id: "zone_orientalbeech",
        name: "Doğu Kayını",
        location: "Karabük/Yenice",
        risk: "Orta",
        riskColor: "var(--risk-moderate)",
        note: "Yüksek nem tutma kapasitesi",
    },
    {
        id: "zone_oak",
        name: "Meşe",
        location: "Kızılcahamam/Ankara",
        risk: "Orta",
        riskColor: "var(--risk-moderate)",
        note: "Vadi konumu, rüzgar kanalı etkisi",
    },
    {
        id: "zone_mixed",
        name: "Karma",
        location: "Belgrad Ormanı/İstanbul",
        risk: "Orta",
        riskColor: "var(--risk-moderate)",
        note: "Karışık yapı, değişken davranış",
    },
    {
        id: "zone_silverfir",
        name: "Göknar",
        location: "Bolu/Abant",
        risk: "Düşük",
        riskColor: "var(--risk-low)",
        note: "Yüksek nem, sık yağış",
    },
    {
        id: "zone_orientalspruce",
        name: "Doğu Ladini",
        location: "Rize/Artvin",
        risk: "Düşük",
        riskColor: "var(--risk-low)",
        note: "En düşük baz sıcaklığı (12°C), yüksek nem",
    },
    {
        id: "zone_alder",
        name: "Kızılağaç",
        location: "Göksu Deltası/Mersin",
        risk: "Düşük",
        riskColor: "var(--risk-low)",
        note: "Sulak alan kenarı, yüksek nem",
    },
];

const DATA_SOURCES = [
    {
        name: "Open-Meteo",
        url: "https://open-meteo.com",
        desc: "Ücretsiz, API anahtarsız hava durumu API'si. PyroSense her bölgenin GPS koordinatları için son 30 günlük günlük yağış toplamını çeker ve kuraklık sınıfını hesaplar. Her saat yenilenir.",
        fields: [
            "precipitation_sum (30 gün)",
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
        ],
    },
    {
        name: "Apache Jena Fuseki",
        url: "https://jena.apache.org/documentation/fuseki2/",
        desc: "OWL 2 ontoloji ve SPARQL endpoint. PyroSense her sensör okumayı RDF Turtle'a çevirir, Fuseki'ye yükler ve SPARQL ile çıkarım yapar. Named graph: http://pyrosense.io/ontology",
        fields: [
            "SPARQL SELECT / UPDATE",
            "Named Graph yönetimi",
            "Admin API (dataset yaratma/silme)",
        ],
    },
    {
        name: "TimescaleDB (PostgreSQL)",
        url: "https://www.timescale.com",
        desc: "Zaman serisi veritabanı. sensor_readings ve risk_scores hypertable olarak tanımlanmış; zaman aralığı sorgularında otomatik chunk partitioning sağlar.",
        fields: ["sensor_readings", "risk_scores", "alarms", "zones", "weather_cache"],
    },
    {
        name: "Eclipse Mosquitto",
        url: "https://mosquitto.org",
        desc: "MQTT 3.1.1 broker. Rust simülatörü pyrosense/# konusuna QoS::AtMostOnce ile yayın yapar. Backend bu konuya abone olarak sensör verilerini alır.",
        fields: ["Topic: pyrosense/{zone_id}", "QoS: AtMostOnce", "Port: 1883"],
    },
];

// ── Bileşenler ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 40 }}>
            <h3
                style={{
                    margin: "0 0 16px",
                    color: "var(--text)",
                    fontSize: 15,
                    fontWeight: 600,
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 10,
                }}
            >
                {title}
            </h3>
            {children}
        </div>
    );
}

function ServiceBadge({
    name,
    health,
    icon,
}: {
    name: string;
    health?: ServiceHealth;
    icon: string;
}) {
    const ok = health?.ok;
    const loading = health === undefined;

    return (
        <div
            style={{
                background: "var(--bg-card)",
                border: `1px solid ${loading ? "var(--border)" : ok ? "var(--risk-low)" : "var(--risk-extreme)"}`,
                borderRadius: 8,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 12,
            }}
        >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>
                    {name}
                </div>
                <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 2 }}>
                    {loading
                        ? "Kontrol ediliyor..."
                        : (health?.detail ?? (ok ? "Çalışıyor" : "Bağlanamadı"))}
                </div>
            </div>
            <div
                style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: loading
                        ? "var(--text-dim)"
                        : ok
                          ? "var(--risk-low)"
                          : "var(--risk-extreme)",
                    boxShadow: loading
                        ? "none"
                        : ok
                          ? "0 0 6px var(--risk-low)"
                          : "0 0 6px var(--risk-extreme)",
                }}
            />
        </div>
    );
}

function FlagCard({ flag }: { flag: (typeof RISK_FLAGS)[0] }) {
    return (
        <div
            style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderLeft: `3px solid ${flag.color}`,
                borderRadius: 8,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>
                    {flag.label}
                </span>
                <span
                    style={{
                        color: flag.color,
                        fontFamily: "var(--font-data)",
                        fontSize: 13,
                        fontWeight: 700,
                    }}
                >
                    +{flag.weight}
                </span>
            </div>
            <div
                style={{
                    background: "var(--bg-overlay)",
                    borderRadius: 4,
                    padding: "4px 8px",
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "var(--secondary)",
                }}
            >
                {flag.condition}
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 12, lineHeight: 1.6 }}>
                {flag.desc}
            </div>
        </div>
    );
}

// ── Ana sayfa ──────────────────────────────────────────────────────────────

export default function SourcesPage() {
    const [health, setHealth] = useState<HealthResult | null>(null);

    useEffect(() => {
        fetch("/health")
            .then((r) => r.json())
            .then(setHealth)
            .catch(() => setHealth(null));

        // 30 saniyede bir yenile
        const timer = setInterval(() => {
            fetch("/health")
                .then((r) => r.json())
                .then(setHealth)
                .catch(() => {});
        }, 30_000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                top: "var(--header-h)",
                left: 0,
                right: 0,
                bottom: 0,
                overflowY: "auto",
                padding: "28px 32px 40px",
                background: "var(--bg)",
            }}
        >
            {/* Başlık */}
            <div style={{ marginBottom: 32 }}>
                <h2
                    style={{
                        margin: 0,
                        color: "var(--text)",
                        fontSize: 18,
                        fontWeight: 600,
                    }}
                >
                    Sistem Bilgisi
                </h2>
                <p style={{ margin: "4px 0 0", color: "var(--text-dim)", fontSize: 12 }}>
                    ontoloji referansı ve veri kaynakları
                </p>
            </div>

            {/* Risk Kuralları */}
            <Section title="OWL Risk Kuralları (9 Bayrak)">
                <p
                    style={{
                        color: "var(--text-dim)",
                        fontSize: 12,
                        margin: "0 0 14px",
                        lineHeight: 1.6,
                    }}
                >
                    Risk skoru 0–100 arası toplamlı bayrak sistemiyle hesaplanır:{" "}
                    <code style={{ color: "var(--secondary)", fontSize: 11 }}>
                        skor = min(100, Σ ağırlıklar)
                    </code>
                    . Her bayrak SPARQL çıkarımıyla OWL ontolojisinden türetilir;
                    bayraklar bulunamazsa statik fallback tablosu devreye girer.
                </p>
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                        gap: 12,
                    }}
                >
                    {RISK_FLAGS.map((f) => (
                        <FlagCard key={f.rule} flag={f} />
                    ))}
                </div>
            </Section>

            {/* Orman Tipleri */}
            <Section title="12 Orman Tipi — Yangın Risk Profilleri">
                <div style={{ overflowX: "auto" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 12,
                        }}
                    >
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                {["Orman Tipi", "Konum", "Risk Seviyesi", "Not"].map(
                                    (h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: "8px 12px",
                                                textAlign: "left",
                                                color: "var(--text-muted)",
                                                fontWeight: 600,
                                                fontSize: 11,
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ),
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {FOREST_TYPES.map((ft) => (
                                <tr
                                    key={ft.id}
                                    style={{
                                        borderBottom: "1px solid var(--border-muted)",
                                    }}
                                >
                                    <td
                                        style={{
                                            padding: "9px 12px",
                                            color: "var(--text)",
                                            fontWeight: 500,
                                        }}
                                    >
                                        {ft.name}
                                    </td>
                                    <td
                                        style={{
                                            padding: "9px 12px",
                                            color: "var(--text-dim)",
                                        }}
                                    >
                                        {ft.location}
                                    </td>
                                    <td style={{ padding: "9px 12px" }}>
                                        <span
                                            style={{
                                                color: ft.riskColor,
                                                fontWeight: 600,
                                                fontSize: 11,
                                                fontFamily: "var(--font-data)",
                                            }}
                                        >
                                            {ft.risk}
                                        </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: "9px 12px",
                                            color: "var(--text-dim)",
                                        }}
                                    >
                                        {ft.note}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>

            {/* Veri Kaynakları */}
            <Section title="📚 Veri Kaynakları ve Entegrasyonlar">
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {DATA_SOURCES.map((src) => (
                        <div
                            key={src.name}
                            style={{
                                background: "var(--bg-card)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                padding: "16px 18px",
                                display: "flex",
                                gap: 16,
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 10,
                                        marginBottom: 6,
                                    }}
                                >
                                    <span
                                        style={{
                                            color: "var(--text)",
                                            fontWeight: 600,
                                            fontSize: 13,
                                        }}
                                    >
                                        {src.name}
                                    </span>
                                    <a
                                        href={src.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            color: "var(--secondary)",
                                            fontSize: 11,
                                            textDecoration: "none",
                                        }}
                                    >
                                        ↗ {src.url.replace("https://", "")}
                                    </a>
                                </div>
                                <div
                                    style={{
                                        color: "var(--text-dim)",
                                        fontSize: 12,
                                        lineHeight: 1.6,
                                        marginBottom: 8,
                                    }}
                                >
                                    {src.desc}
                                </div>
                                <div
                                    style={{ display: "flex", flexWrap: "wrap", gap: 6 }}
                                >
                                    {src.fields.map((f) => (
                                        <span
                                            key={f}
                                            style={{
                                                background: "var(--bg-overlay)",
                                                color: "var(--text-muted)",
                                                borderRadius: 4,
                                                padding: "2px 8px",
                                                fontSize: 11,
                                                fontFamily: "monospace",
                                            }}
                                        >
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>
        </div>
    );
}
