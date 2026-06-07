import axios from "axios";
import {
    FUSEKI_URL,
    FUSEKI_DATASET,
    FUSEKI_USER,
    FUSEKI_PASSWORD,
    ONTOLOGY_GRAPH,
} from "../constants";
import { getDb } from "./database";

// Tipler

export interface InferredFlag {
    rule: string;
    label: string;
    condition: string;
    weight: number;
}

export interface RuleMeta {
    weight: number;
    label: string;
}

// OWL named graph sorgusunun başarısız olması durumunda kullanılan statik fallback.
// Değerler pyrosense-core.owl'daki pyro:ruleWeight değerleriyle birebir eşleşir.
//
// Eklenmesinin sebebi ise flaglerin agirliklari gelmez ise
// risk scorelarini yine de hesaplamayi saglamak.
//
const RULE_META_STATIC: Record<string, RuleMeta> = {
    FLAME_DETECTED: { weight: 65, label: "Alev Tespiti" },
    SMOKE_ALARM: { weight: 35, label: "Duman Alarmı" },
    SLOPE_FIRE_SPREAD_CRITICAL: { weight: 30, label: "Yamaç Yayılım Kritik" },
    EARLY_FIRE_SIGNAL: { weight: 25, label: "Erken Yangın Sinyali" },
    DOWNWIND_SPREAD_THREAT: { weight: 25, label: "Rüzgar Altı Yayılım Tehdidi" },
    HIGH_DROUGHT_RISK: { weight: 20, label: "Yüksek Kuraklık Riski" },
    HIGH_SPREAD_RISK: { weight: 20, label: "Yüksek Yayılım Riski" },
    VALLEY_WIND_AMPLIFICATION: { weight: 15, label: "Vadi Rüzgar Etkisi" },
    SOUTH_WIND_SLOPE_HAZARD: { weight: 15, label: "Güney Rüzgar Yamaç Tehlikesi" },
    RIDGE_WIND_EXPOSURE: { weight: 10, label: "Sırt Rüzgar Açıklığı" },
};

type Binding = Record<string, { value: string }>;

// ============================================================
// Fuseki Concurrency Limiter (Semaphore)
//
// 12 bölge aynı anda mesaj gönderdiğinde her bölge 8 paralel
// SPARQL sorgusu açar → 96 eşzamanlı istek Fuseki'yi çökertir.
// Semaphore maksimum eşzamanlı Fuseki isteğini MAX_CONCURRENT
// ile sınırlar; fazlası kuyruğa girer ve sırayla işlenir.
// ============================================================
const MAX_CONCURRENT_SPARQL = 8;

class Semaphore {
    private slots: number;
    private queue: (() => void)[] = [];

    constructor(max: number) {
        this.slots = max;
    }

    acquire(): Promise<void> {
        if (this.slots > 0) {
            this.slots--;
            return Promise.resolve();
        }
        return new Promise((resolve) => this.queue.push(resolve));
    }

    release(): void {
        const next = this.queue.shift();
        if (next) {
            next();
        } else {
            this.slots++;
        }
    }
}

const fusekiSem = new Semaphore(MAX_CONCURRENT_SPARQL);

// Sabitler

const PREFIXES = `
PREFIX pyro: <http://pyrosense.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ssn:  <http://www.w3.org/ns/ssn/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
`.trim();

// SPARQL yardımcı

async function sparqlSelect(query: string): Promise<Binding[]> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/sparql`;

    await fusekiSem.acquire();
    try {
        const response = await axios.get(url, {
            params: { query },
            headers: { Accept: "application/sparql-results+json" },
            auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
            timeout: 8000,
        });
        return response.data.results.bindings ?? [];
    } catch (err: any) {
        // Axios timeout → ECONNABORTED | ağ hatası → ECONNRESET / ECONNREFUSED
        // Bunlar Fuseki geçici yük altındayken beklenen hatalar — sessizce atla
        const code = err?.code ?? "";
        const silentCodes = ["ECONNRESET", "ECONNABORTED", "ECONNREFUSED", "ETIMEDOUT"];
        if (!silentCodes.includes(code)) {
            console.error("[inferenceService] SPARQL hatası:", err.message ?? err);
        }
        return [];
    } finally {
        fusekiSem.release();
    }
}

// Ortak triple pattern
// Her sorgu bu bloğu kullanır. droughtClass → ?drought → ?mult hesaplanır.

function basePattern(readingUri: string): string {
    return `
    <${readingUri}>
        pyro:temperature    ?temp ;
        pyro:humidity       ?hum ;
        pyro:smokePpm       ?smoke ;
        pyro:windSpeedMs    ?wind ;
        pyro:co2Ppm         ?co2 ;
        pyro:flameDetected  ?flame ;
        ssn:isObservedBy    ?node .
    ?node
        pyro:forestType     ?ft ;
        pyro:topology       ?topo ;
        pyro:droughtClass   ?drought .
    BIND(IF(?drought = "ExtremeDrought",  0.8,
         IF(?drought = "ModerateDrought", 0.9, 1.0)) AS ?mult)`;
}

// Ana fonksiyon

export async function inferRiskFlags(readingUri: string): Promise<InferredFlag[]> {
    // Q1–Q8: tüm sorgular paralel olarak başlatılır
    const q1 = `
${PREFIXES}
SELECT ?ft ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(?flame = true)
}
LIMIT 1`;

    const q2 = `
${PREFIXES}
SELECT ?ft ?temp ?hum ?mult WHERE {
    ${basePattern(readingUri)}
    FILTER(
        (?ft = "RedPine"        && ?temp > (32.0 * ?mult) && ?hum < 30.0) ||
        (?ft = "BlackPine"      && ?temp > (30.0 * ?mult) && ?hum < 30.0) ||
        (?ft = "ScotsPine"      && ?temp > (28.0 * ?mult) && ?hum < 30.0) ||
        (?ft = "TaurusCedar"    && ?temp > (30.0 * ?mult) && ?hum < 28.0) ||
        (?ft = "SilverFir"      && ?temp > (33.0 * ?mult) && ?hum < 25.0) ||
        (?ft = "OrientalSpruce" && ?temp > (33.0 * ?mult) && ?hum < 22.0) ||
        (?ft = "Oak"            && ?temp > (34.0 * ?mult) && ?hum < 25.0) ||
        (?ft = "OrientalBeech"  && ?temp > (35.0 * ?mult) && ?hum < 25.0) ||
        (?ft = "Alder"          && ?temp > (36.0 * ?mult) && ?hum < 20.0) ||
        (?ft = "Shrubland"      && ?temp > (30.0 * ?mult) && ?hum < 25.0) ||
        (?ft = "Juniper"        && ?temp > (30.0 * ?mult) && ?hum < 28.0) ||
        (?ft = "Mixed"          && ?temp > (31.0 * ?mult) && ?hum < 30.0)
    )
}
LIMIT 1`;

    const q3 = `
${PREFIXES}
SELECT ?ft ?smoke ?mult WHERE {
    ${basePattern(readingUri)}
    FILTER(
        (?ft = "RedPine"        && ?smoke > (75.0  * ?mult)) ||
        (?ft = "BlackPine"      && ?smoke > (75.0  * ?mult)) ||
        (?ft = "ScotsPine"      && ?smoke > (80.0  * ?mult)) ||
        (?ft = "TaurusCedar"    && ?smoke > (85.0  * ?mult)) ||
        (?ft = "SilverFir"      && ?smoke > (72.0  * ?mult)) ||
        (?ft = "OrientalSpruce" && ?smoke > (72.0  * ?mult)) ||
        (?ft = "Oak"            && ?smoke > (80.0  * ?mult)) ||
        (?ft = "OrientalBeech"  && ?smoke > (72.0  * ?mult)) ||
        (?ft = "Alder"          && ?smoke > (72.0  * ?mult)) ||
        (?ft = "Shrubland"      && ?smoke > (60.0  * ?mult)) ||
        (?ft = "Juniper"        && ?smoke > (80.0  * ?mult)) ||
        (?ft = "Mixed"          && ?smoke > (90.0  * ?mult))
    )
}
LIMIT 1`;

    const q4 = `
${PREFIXES}
SELECT ?ft ?wind ?temp ?mult WHERE {
    ${basePattern(readingUri)}
    FILTER(
        (?ft = "RedPine"        && ?wind > (7.0  * ?mult) && ?temp > 30.0) ||
        (?ft = "BlackPine"      && ?wind > (7.0  * ?mult) && ?temp > 27.0) ||
        (?ft = "ScotsPine"      && ?wind > (7.0  * ?mult) && ?temp > 25.0) ||
        (?ft = "TaurusCedar"    && ?wind > (7.0  * ?mult) && ?temp > 28.0) ||
        (?ft = "SilverFir"      && ?wind > (9.0  * ?mult) && ?temp > 28.0) ||
        (?ft = "OrientalSpruce" && ?wind > (10.0 * ?mult) && ?temp > 28.0) ||
        (?ft = "Oak"            && ?wind > (9.0  * ?mult) && ?temp > 30.0) ||
        (?ft = "OrientalBeech"  && ?wind > (10.0 * ?mult) && ?temp > 32.0) ||
        (?ft = "Alder"          && ?wind > (11.0 * ?mult) && ?temp > 33.0) ||
        (?ft = "Shrubland"      && ?wind > (6.0  * ?mult) && ?temp > 28.0) ||
        (?ft = "Juniper"        && ?wind > (7.0  * ?mult) && ?temp > 27.0) ||
        (?ft = "Mixed"          && ?wind > (8.0  * ?mult) && ?temp > 28.0)
    )
}
LIMIT 1`;

    // Q5: CO₂ + duman kombinasyonu — droughtClass çarpanı uygulanmaz
    const q5 = `
${PREFIXES}
SELECT ?ft ?co2 ?smoke WHERE {
    ${basePattern(readingUri)}
    FILTER(
        (?ft = "RedPine"        && ?co2 > 800.0  && ?smoke > 40.0) ||
        (?ft = "BlackPine"      && ?co2 > 850.0  && ?smoke > 50.0) ||
        (?ft = "ScotsPine"      && ?co2 > 850.0  && ?smoke > 50.0) ||
        (?ft = "TaurusCedar"    && ?co2 > 870.0  && ?smoke > 55.0) ||
        (?ft = "SilverFir"      && ?co2 > 700.0  && ?smoke > 40.0) ||
        (?ft = "OrientalSpruce" && ?co2 > 700.0  && ?smoke > 40.0) ||
        (?ft = "Oak"            && ?co2 > 750.0  && ?smoke > 50.0) ||
        (?ft = "OrientalBeech"  && ?co2 > 750.0  && ?smoke > 50.0) ||
        (?ft = "Alder"          && ?co2 > 800.0  && ?smoke > 55.0) ||
        (?ft = "Shrubland"      && ?co2 > 750.0  && ?smoke > 30.0) ||
        (?ft = "Juniper"        && ?co2 > 880.0  && ?smoke > 55.0) ||
        (?ft = "Mixed"          && ?co2 > 880.0  && ?smoke > 60.0)
    )
}
LIMIT 1`;

    const q6 = `
${PREFIXES}
SELECT ?wind ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(?topo = "Valley" && ?wind > 6.0 && ?temp > 25.0)
}
LIMIT 1`;

    const q7 = `
${PREFIXES}
SELECT ?wind WHERE {
    ${basePattern(readingUri)}
    FILTER(?topo = "Ridge" && ?wind > 8.0)
}
LIMIT 1`;

    const q8 = `
${PREFIXES}
SELECT ?wind ?hum ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(?topo = "Slope" && ?wind > 5.0 && ?hum < 30.0 && ?temp > 30.0)
}
LIMIT 1`;

    // Q9: SOUTH_WIND_SLOPE_HAZARD
    //
    // Güney sektörü rüzgarı (135°–225°: SE→S→SW) + yamaç topolojisi kombinasyonu.
    //
    // Fiziksel gerekçe:
    //   Türkiye'de yangın mevsiminde hakim tehlikeli rüzgarlar güney kökenlidir:
    //     - Lodos (GB, ~225°): sıcak-kuru, Ege/Akdeniz kıyısında birincil yangın rüzgarı
    //     - Kıble/Sirokko (G, ~180°): Sahra orijinli, nem < 15% ile gelebilir
    //     - Keşişleme (GD, ~135°): yaz aylarında ısıtıcı etkisi var
    //   Yamaç topolojisinde güney rüzgarı alevleri yukarı doğru iter (baca etkisi):
    //     alevlerin önündeki vejetasyon hava akımıyla ısınır → yayılma hızı 2-3× artar.
    //
    // Eşikler:
    //   windDirDeg ∈ [135, 225] → güney sektörü (45° toleranslı)
    //   windSpeedMs > 4.0       → anlamsız hava hareketini filtrele (Q8'den 1 m/s düşük;
    //                             yön faktörü ek tehlike katar)
    //   temperature > 25.0      → temel sıcak koşul (düşük eşik: yön + sıcaklık yeterli)
    //
    // windDirDeg ^^xsd:double olarak Fuseki'ye yazılır (rdfConverter.ts'te düzeltildi).
    const q9 = `
${PREFIXES}
SELECT ?windDir ?wind ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(
        ?topo = "Slope"          &&
        ?windDir >= 135.0        &&
        ?windDir <= 225.0        &&
        ?wind    >   4.0         &&
        ?temp    >  25.0
    )
}
LIMIT 1`;

    // 9 sorguyu aynı anda Fuseki'ye gönder
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
        sparqlSelect(q1),
        sparqlSelect(q2),
        sparqlSelect(q3),
        sparqlSelect(q4),
        sparqlSelect(q5),
        sparqlSelect(q6),
        sparqlSelect(q7),
        sparqlSelect(q8),
        sparqlSelect(q9),
    ]);

    const flags: { rule: string; condition: string }[] = [];

    // Q1: FLAME_DETECTED
    if (r1.length > 0) {
        const b = r1[0];
        flags.push({
            rule: "FLAME_DETECTED",
            condition: `${b.ft.value} | Alev sensörü aktif sinyal verdi (${parseFloat(b.temp.value).toFixed(1)}°C)`,
        });
    }

    // Q2: HIGH_DROUGHT_RISK
    if (r2.length > 0) {
        const b = r2[0];
        flags.push({
            rule: "HIGH_DROUGHT_RISK",
            condition:
                `${b.ft.value} | Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C` +
                ` & Nem %${parseFloat(b.hum.value).toFixed(0)}` +
                ` (kuraklık çarpanı: ×${parseFloat(b.mult.value).toFixed(1)})`,
        });
    }

    // Q3: SMOKE_ALARM
    if (r3.length > 0) {
        const b = r3[0];
        flags.push({
            rule: "SMOKE_ALARM",
            condition:
                `${b.ft.value} | Duman ${parseFloat(b.smoke.value).toFixed(0)} ppm` +
                ` (kuraklık çarpanı: ×${parseFloat(b.mult.value).toFixed(1)})`,
        });
    }

    // Q4: HIGH_SPREAD_RISK
    if (r4.length > 0) {
        const b = r4[0];
        flags.push({
            rule: "HIGH_SPREAD_RISK",
            condition:
                `${b.ft.value} | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
        });
    }

    // Q5: EARLY_FIRE_SIGNAL
    if (r5.length > 0) {
        const b = r5[0];
        flags.push({
            rule: "EARLY_FIRE_SIGNAL",
            condition:
                `${b.ft.value} | CO₂ ${parseFloat(b.co2.value).toFixed(0)} ppm` +
                ` & Duman ${parseFloat(b.smoke.value).toFixed(0)} ppm`,
        });
    }

    // Q6: VALLEY_WIND_AMPLIFICATION
    if (r6.length > 0) {
        const b = r6[0];
        flags.push({
            rule: "VALLEY_WIND_AMPLIFICATION",
            condition:
                `Vadi | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
        });
    }

    // Q7: RIDGE_WIND_EXPOSURE
    if (r7.length > 0) {
        const b = r7[0];
        flags.push({
            rule: "RIDGE_WIND_EXPOSURE",
            condition: `Sırt | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s > 8 m/s`,
        });
    }

    // Q8: SLOPE_FIRE_SPREAD_CRITICAL
    if (r8.length > 0) {
        const b = r8[0];
        flags.push({
            rule: "SLOPE_FIRE_SPREAD_CRITICAL",
            condition:
                `Yamaç | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                ` & Nem %${parseFloat(b.hum.value).toFixed(0)}` +
                ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
        });
    }

    // Q9: SOUTH_WIND_SLOPE_HAZARD
    if (r9.length > 0) {
        const b = r9[0];
        const dirDeg = parseFloat(b.windDir.value).toFixed(0);
        // Yön etiketi: Lodos (210-240°), Kıble (150-210°), Keşişleme (135-150°)
        const dir = parseFloat(b.windDir.value);
        const dirLabel =
            dir >= 210 ? "Lodos (GB)" :
            dir >= 165 ? "Kıble (G)"  :
                         "Keşişleme (GD)";
        flags.push({
            rule: "SOUTH_WIND_SLOPE_HAZARD",
            condition:
                `Yamaç | ${dirLabel} ${dirDeg}°` +
                ` ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
        });
    }

    // Tetiklenen kuralların metadata'sını (ağırlık + label) OWL named graph'tan al.
    // Fuseki named graph boşsa veya sorgu başarısız olursa RULE_META_STATIC fallback devreye girer.
    const meta = await fetchRuleMeta(flags.map((f) => f.rule));
    return flags.map((f) => ({
        rule: f.rule,
        label: meta[f.rule]?.label ?? RULE_META_STATIC[f.rule]?.label ?? f.rule,
        condition: f.condition,
        weight: meta[f.rule]?.weight ?? RULE_META_STATIC[f.rule]?.weight ?? 0,
    }));
}

// Kural metadata cache — OWL'daki ruleWeight/label değerleri çalışma
// süresince değişmez. Her okumada Fuseki'ye sormak yerine ilk başarılı
// yanıtı hafızada tut. Bu, Fuseki üzerindeki eşzamanlı istek yükünü
// önemli ölçüde azaltır.
const ruleMetaCache: Record<string, RuleMeta> = {};

export async function fetchRuleMeta(
    ruleIds: string[],
): Promise<Record<string, RuleMeta>> {
    if (ruleIds.length === 0) return {};

    // Cache'te olmayan rule ID'lerini bul
    const missing = ruleIds.filter((id) => !(id in ruleMetaCache));

    if (missing.length > 0) {
        const values = missing.map((id) => `"${id}"`).join(", ");

        const q = `
        ${PREFIXES}
        SELECT ?ruleId ?weight ?label WHERE {
            GRAPH <${ONTOLOGY_GRAPH}> {
                ?rule a pyro:RiskRule ;
                      pyro:ruleId     ?ruleId ;
                      pyro:ruleWeight ?weight ;
                      rdfs:label      ?label .
                FILTER(?ruleId IN (${values}))
            }
        }`;

        const rows = await sparqlSelect(q);
        for (const b of rows) {
            ruleMetaCache[b.ruleId.value] = {
                weight: parseInt(b.weight.value, 10),
                label: b.label.value,
            };
        }
    }

    // İstenen tüm rule'ları cache'ten döndür
    const result: Record<string, RuleMeta> = {};
    for (const id of ruleIds) {
        if (ruleMetaCache[id]) result[id] = ruleMetaCache[id];
    }
    return result;
}

// ============================================================
// BÖLGELER ARASI RÜZGAR YAYILIM ÇIKARIMI
//
// Mantık:
//   1. SPARQL → OWL named graph'tan tüm zone koordinatları
//   2. PostgreSQL → son 10 dakikada HIGH/EXTREME risk üreten
//      zone'ların en güncel rüzgar yönü ve hızı
//   3. TypeScript bearing hesabı:
//      bearing(kaynak → hedef) ≈ kaynak rüzgar yönü (±CONE_DEG)
//      VE rüzgar hızı > MIN_WIND_MS
//      → hedef zone DOWNWIND_SPREAD_THREAT alır
// ============================================================

const CONE_DEG = 45; // rüzgar yönü tolerans açısı (her iki taraf)
const MIN_WIND_MS = 4.0; // minimum rüzgar hızı eşiği
const LOOKBACK_MIN = 10; // kaç dakika geriye bakılacak
const MAX_DIST_KM = 150; // bu mesafenin ötesindeki zone'lar ihmal edilir

// WGS-84 bearing: kaynak → hedef (0-360°, kuzey = 0)
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = Math.PI / 180;
    const dLon = (lon2 - lon1) * toRad;
    const φ1 = lat1 * toRad;
    const φ2 = lat2 * toRad;
    const y = Math.sin(dLon) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
    return (Math.atan2(y, x) / toRad + 360) % 360;
}

// Haversine mesafe (km)
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Açısal fark — 360° wrap-around'ı doğru ele alır
function angleDiff(a: number, b: number): number {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

interface ZoneCoord {
    zoneId: string;
    lat: number;
    lon: number;
}

interface HotZoneWind {
    zoneId: string;
    windDirDeg: number;
    windSpeedMs: number;
}

// Zone koordinat cache — koordinatlar hiç değişmez, her DOWNWIND
// hesabında Fuseki'ye sormak yerine ilk başarılı yanıtı sakla.
let zoneCoordsCache: ZoneCoord[] | null = null;

// Adım 1: OWL named graph'tan tüm zone koordinatlarını çek
async function fetchZoneCoords(): Promise<ZoneCoord[]> {
    if (zoneCoordsCache !== null) return zoneCoordsCache;

    const q = `
${PREFIXES}
SELECT ?zoneId ?lat ?lon WHERE {
  GRAPH <${ONTOLOGY_GRAPH}> {
    ?zone a pyro:Zone ;
          pyro:zoneId   ?zoneId ;
          pyro:latitude  ?lat ;
          pyro:longitude ?lon .
  }
}`;
    const rows = await sparqlSelect(q);
    const coords = rows.map((b) => ({
        zoneId: b.zoneId.value,
        lat: parseFloat(b.lat.value),
        lon: parseFloat(b.lon.value),
    }));

    if (coords.length > 0) {
        zoneCoordsCache = coords; // sadece başarılı yanıtta cache'le
    }
    return coords;
}

// Adım 2: Son LOOKBACK_MIN dakikada HIGH/EXTREME risk üreten zone'ların
//         en güncel rüzgar verisini PostgreSQL'den çek
async function fetchHotZoneWinds(excludeZoneId: string): Promise<HotZoneWind[]> {
    const db = getDb();
    const sql = `
        WITH hot_zones AS (
            SELECT DISTINCT zone_id
            FROM risk_scores
            WHERE time > NOW() - INTERVAL '${LOOKBACK_MIN} minutes'
              AND level IN ('HIGH', 'EXTREME')
              AND zone_id != $1
        ),
        latest_wind AS (
            SELECT DISTINCT ON (s.zone_id)
                s.zone_id,
                s.wind_speed_ms,
                s.wind_dir_deg
            FROM sensor_readings s
            WHERE s.zone_id IN (SELECT zone_id FROM hot_zones)
            ORDER BY s.zone_id, s.time DESC
        )
        SELECT zone_id, wind_speed_ms, wind_dir_deg FROM latest_wind
    `;
    const result = await db.query(sql, [excludeZoneId]);
    return result.rows
        .filter((r: any) => r.wind_dir_deg != null && r.wind_speed_ms != null)
        .map((r: any) => ({
            zoneId: r.zone_id,
            windDirDeg: parseFloat(r.wind_dir_deg),
            windSpeedMs: parseFloat(r.wind_speed_ms),
        }));
}

// Ana fonksiyon: mevcut zone için DOWNWIND_SPREAD_THREAT kontrolü
//
// currentSmokePpm: bölgenin anlık duman okuması.
// Normal senaryoda duman 0-15 ppm → DOWNWIND asla tetiklenmez.
// PreFire/ActiveFire senaryosunda duman 80+ ppm → DOWNWIND tetiklenir.
// Bu gate olmadan, komşu bölgelerde activefire çalışırken normal bölgeler
// DOWNWIND(25) + RIDGE(10)/VALLEY(15) kombinasyonuyla yanlış MODERATE alır.
export async function inferDownwindThreats(
    currentZoneId: string,
    currentSmokePpm: number,
): Promise<InferredFlag | null> {
    // Yerel duman eşiği: 25 ppm altında DOWNWIND bayrağı anlamlı değil.
    // Normal koşullarda duman 0-15 ppm → DOWNWIND sessizleşir.
    if (currentSmokePpm < 25) return null;
    try {
        const [coords, hotWinds] = await Promise.all([
            fetchZoneCoords(),
            fetchHotZoneWinds(currentZoneId),
        ]);

        if (hotWinds.length === 0) return null;

        const coordMap = new Map(coords.map((c) => [c.zoneId, c]));
        const targetCoord = coordMap.get(currentZoneId);
        if (!targetCoord) return null;

        const threats: string[] = [];

        for (const hot of hotWinds) {
            if (hot.windSpeedMs < MIN_WIND_MS) continue;

            const srcCoord = coordMap.get(hot.zoneId);
            if (!srcCoord) continue;

            const dist = distanceKm(
                srcCoord.lat,
                srcCoord.lon,
                targetCoord.lat,
                targetCoord.lon,
            );
            if (dist > MAX_DIST_KM) continue;

            const bearing = bearingDeg(
                srcCoord.lat,
                srcCoord.lon,
                targetCoord.lat,
                targetCoord.lon,
            );
            const diff = angleDiff(hot.windDirDeg, bearing);

            if (diff <= CONE_DEG) {
                threats.push(
                    `${hot.zoneId} → ${currentZoneId} ` +
                        `| bearing=${bearing.toFixed(0)}° windDir=${hot.windDirDeg.toFixed(0)}° ` +
                        `diff=${diff.toFixed(0)}° dist=${dist.toFixed(0)}km ` +
                        `wind=${hot.windSpeedMs.toFixed(1)}m/s`,
                );
            }
        }

        if (threats.length === 0) return null;

        const meta = await fetchRuleMeta(["DOWNWIND_SPREAD_THREAT"]);
        return {
            rule: "DOWNWIND_SPREAD_THREAT",
            label: meta["DOWNWIND_SPREAD_THREAT"]?.label ?? "Rüzgar Altı Yayılım Tehdidi",
            condition: threats.join(" | "),
            weight: meta["DOWNWIND_SPREAD_THREAT"]?.weight ?? 25,
        };
    } catch (err) {
        console.error("[inferDownwindThreats] hata:", err);
        return null;
    }
}
