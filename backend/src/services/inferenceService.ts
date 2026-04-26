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

type Binding = Record<string, { value: string }>;

// Sabitler

const PREFIXES = `
PREFIX pyro: <http://pyrosense.io/ontology#>
PREFIX ssn:  <http://www.w3.org/ns/ssn/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
`.trim();

// SPARQL yardımcı

async function sparqlSelect(query: string): Promise<Binding[]> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/sparql`;
    try {
        const response = await axios.get(url, {
            params: { query },
            headers: { Accept: "application/sparql-results+json" },
            auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
        });
        return response.data.results.bindings ?? [];
    } catch (err) {
        console.error("[inferenceService] SPARQL hatası:", err);
        return [];
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
    const flags: Omit<InferredFlag, "weight">[] = [];

    // Q1: FLAME_DETECTED
    {
        const q = `
${PREFIXES}
SELECT ?ft ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(?flame = true)
}
LIMIT 1`;
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "FLAME_DETECTED",
                label: "Alev Tespiti",
                condition: `${b.ft.value} | Alev sensörü aktif sinyal verdi (${parseFloat(b.temp.value).toFixed(1)}°C)`,
            });
        }
    }

    // Q2: HIGH_DROUGHT_RISK
    {
        const q = `
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
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "HIGH_DROUGHT_RISK",
                label: "Yüksek Kuraklık Riski",
                condition:
                    `${b.ft.value} | Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C` +
                    ` & Nem %${parseFloat(b.hum.value).toFixed(0)}` +
                    ` (kuraklık çarpanı: ×${parseFloat(b.mult.value).toFixed(1)})`,
            });
        }
    }

    // Q3: SMOKE_ALARM
    {
        const q = `
${PREFIXES}
SELECT ?ft ?smoke ?mult WHERE {
    ${basePattern(readingUri)}
    FILTER(
        (?ft = "RedPine"        && ?smoke > (75.0  * ?mult)) ||
        (?ft = "BlackPine"      && ?smoke > (75.0  * ?mult)) ||
        (?ft = "ScotsPine"      && ?smoke > (80.0  * ?mult)) ||
        (?ft = "TaurusCedar"    && ?smoke > (85.0  * ?mult)) ||
        (?ft = "SilverFir"      && ?smoke > (105.0 * ?mult)) ||
        (?ft = "OrientalSpruce" && ?smoke > (140.0 * ?mult)) ||
        (?ft = "Oak"            && ?smoke > (110.0 * ?mult)) ||
        (?ft = "OrientalBeech"  && ?smoke > (120.0 * ?mult)) ||
        (?ft = "Alder"          && ?smoke > (130.0 * ?mult)) ||
        (?ft = "Shrubland"      && ?smoke > (60.0  * ?mult)) ||
        (?ft = "Juniper"        && ?smoke > (80.0  * ?mult)) ||
        (?ft = "Mixed"          && ?smoke > (90.0  * ?mult))
    )
}
LIMIT 1`;
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "SMOKE_ALARM",
                label: "Duman Alarmı",
                condition:
                    `${b.ft.value} | Duman ${parseFloat(b.smoke.value).toFixed(0)} ppm` +
                    ` (kuraklık çarpanı: ×${parseFloat(b.mult.value).toFixed(1)})`,
            });
        }
    }

    // Q4: HIGH_SPREAD_RISK
    {
        const q = `
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
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "HIGH_SPREAD_RISK",
                label: "Yüksek Yayılım Riski",
                condition:
                    `${b.ft.value} | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                    ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
            });
        }
    }

    // Q5: EARLY_FIRE_SIGNAL
    // CO₂ + duman kombinasyonu — droughtClass çarpanı uygulanmaz (sensör doğruluğu)
    {
        const q = `
${PREFIXES}
SELECT ?ft ?co2 ?smoke WHERE {
    ${basePattern(readingUri)}
    FILTER(
        (?ft = "RedPine"        && ?co2 > 800.0  && ?smoke > 40.0) ||
        (?ft = "BlackPine"      && ?co2 > 850.0  && ?smoke > 50.0) ||
        (?ft = "ScotsPine"      && ?co2 > 850.0  && ?smoke > 50.0) ||
        (?ft = "TaurusCedar"    && ?co2 > 870.0  && ?smoke > 55.0) ||
        (?ft = "SilverFir"      && ?co2 > 900.0  && ?smoke > 65.0) ||
        (?ft = "OrientalSpruce" && ?co2 > 950.0  && ?smoke > 75.0) ||
        (?ft = "Oak"            && ?co2 > 900.0  && ?smoke > 70.0) ||
        (?ft = "OrientalBeech"  && ?co2 > 950.0  && ?smoke > 80.0) ||
        (?ft = "Alder"          && ?co2 > 1000.0 && ?smoke > 85.0) ||
        (?ft = "Shrubland"      && ?co2 > 750.0  && ?smoke > 30.0) ||
        (?ft = "Juniper"        && ?co2 > 880.0  && ?smoke > 55.0) ||
        (?ft = "Mixed"          && ?co2 > 880.0  && ?smoke > 60.0)
    )
}
LIMIT 1`;
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "EARLY_FIRE_SIGNAL",
                label: "Erken Yangın Sinyali",
                condition:
                    `${b.ft.value} | CO₂ ${parseFloat(b.co2.value).toFixed(0)} ppm` +
                    ` & Duman ${parseFloat(b.smoke.value).toFixed(0)} ppm`,
            });
        }
    }

    // Q6: VALLEY_WIND_AMPLIFICATION
    {
        const q = `
${PREFIXES}
SELECT ?wind ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(?topo = "Valley" && ?wind > 6.0 && ?temp > 25.0)
}
LIMIT 1`;
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "VALLEY_WIND_AMPLIFICATION",
                label: "Vadi Rüzgar Etkisi",
                condition:
                    `Vadi | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                    ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
            });
        }
    }

    // Q7: RIDGE_WIND_EXPOSURE
    {
        const q = `
${PREFIXES}
SELECT ?wind WHERE {
    ${basePattern(readingUri)}
    FILTER(?topo = "Ridge" && ?wind > 8.0)
}
LIMIT 1`;
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "RIDGE_WIND_EXPOSURE",
                label: "Sırt Rüzgar Açıklığı",
                condition: `Sırt | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s > 8 m/s`,
            });
        }
    }

    // Q8: SLOPE_FIRE_SPREAD_CRITICAL
    {
        const q = `
${PREFIXES}
SELECT ?wind ?hum ?temp WHERE {
    ${basePattern(readingUri)}
    FILTER(?topo = "Slope" && ?wind > 5.0 && ?hum < 30.0 && ?temp > 30.0)
}
LIMIT 1`;
        const rows = await sparqlSelect(q);
        if (rows.length > 0) {
            const b = rows[0];
            flags.push({
                rule: "SLOPE_FIRE_SPREAD_CRITICAL",
                label: "Yamaç Yayılım Kritik",
                condition:
                    `Yamaç | Rüzgar ${parseFloat(b.wind.value).toFixed(1)} m/s` +
                    ` & Nem %${parseFloat(b.hum.value).toFixed(0)}` +
                    ` & Sıcaklık ${parseFloat(b.temp.value).toFixed(1)}°C`,
            });
        }
    }
    const weights = await fetchRuleWeights(flags.map((f) => f.rule));
    return flags.map((f) => ({ ...f, weight: weights[f.rule] ?? 0 }));
}

export async function fetchRuleWeights(
    rulesId: string[],
): Promise<Record<string, number>> {
    if (rulesId.length === 0) return {};

    const values = rulesId.map((id) => `"${id}"`).join(", ");

    const q = `
            ${PREFIXES}
            SELECT ?ruleId ?weight WHERE {
                GRAPH <${ONTOLOGY_GRAPH}> {
                    ?rule a pyro:RiskRule ;
                        pyro:ruleId     ?ruleId ;
                        pyro:ruleWeight ?weight .
                    FILTER(?ruleId IN (${values}))
                }
            }`;

    const rows = await sparqlSelect(q);
    const map: Record<string, number> = {};

    for (const b of rows) {
        map[b.ruleId.value] = parseInt(b.weight.value, 10);
    }

    return map;
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

const CONE_DEG = 45;       // rüzgar yönü tolerans açısı (her iki taraf)
const MIN_WIND_MS = 4.0;   // minimum rüzgar hızı eşiği
const LOOKBACK_MIN = 10;   // kaç dakika geriye bakılacak
const MAX_DIST_KM = 150;   // bu mesafenin ötesindeki zone'lar ihmal edilir

// WGS-84 bearing: kaynak → hedef (0-360°, kuzey = 0)
function bearingDeg(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const toRad = Math.PI / 180;
    const dLon = (lon2 - lon1) * toRad;
    const φ1 = lat1 * toRad;
    const φ2 = lat2 * toRad;
    const y = Math.sin(dLon) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
    return ((Math.atan2(y, x) / toRad) + 360) % 360;
}

// Haversine mesafe (km)
function distanceKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
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

// Adım 1: OWL named graph'tan tüm zone koordinatlarını çek
async function fetchZoneCoords(): Promise<ZoneCoord[]> {
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
    return rows.map((b) => ({
        zoneId: b.zoneId.value,
        lat:    parseFloat(b.lat.value),
        lon:    parseFloat(b.lon.value),
    }));
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
            zoneId:      r.zone_id,
            windDirDeg:  parseFloat(r.wind_dir_deg),
            windSpeedMs: parseFloat(r.wind_speed_ms),
        }));
}

// Ana fonksiyon: mevcut zone için DOWNWIND_SPREAD_THREAT kontrolü
export async function inferDownwindThreats(
    currentZoneId: string,
): Promise<InferredFlag | null> {
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

            const dist = distanceKm(srcCoord.lat, srcCoord.lon, targetCoord.lat, targetCoord.lon);
            if (dist > MAX_DIST_KM) continue;

            const bearing = bearingDeg(
                srcCoord.lat, srcCoord.lon,
                targetCoord.lat, targetCoord.lon,
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

        const weights = await fetchRuleWeights(["DOWNWIND_SPREAD_THREAT"]);
        return {
            rule:      "DOWNWIND_SPREAD_THREAT",
            label:     "Rüzgar Altı Yayılım Tehdidi",
            condition: threats.join(" | "),
            weight:    weights["DOWNWIND_SPREAD_THREAT"] ?? 25,
        };
    } catch (err) {
        console.error("[inferDownwindThreats] hata:", err);
        return null;
    }
}
