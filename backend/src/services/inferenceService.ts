import axios from "axios";
import {
    FUSEKI_URL,
    FUSEKI_DATASET,
    FUSEKI_USER,
    FUSEKI_PASSWORD,
    ONTOLOGY_GRAPH,
} from "../constants";
import { getDb } from "./database";
import { JRL_THRESHOLDS, TOPOLOGY_THRESHOLDS } from "../generated/ruleThresholds";

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
const RULE_META_STATIC: Record<string, RuleMeta> = {
    FLAME_DETECTED:             { weight: 65, label: "Alev Tespiti" },
    SMOKE_ALARM:                { weight: 35, label: "Duman Alarmı" },
    SLOPE_FIRE_SPREAD_CRITICAL: { weight: 30, label: "Yamaç Yayılım Kritik" },
    EARLY_FIRE_SIGNAL:          { weight: 25, label: "Erken Yangın Sinyali" },
    DOWNWIND_SPREAD_THREAT:     { weight: 25, label: "Rüzgar Altı Yayılım Tehdidi" },
    HIGH_DROUGHT_RISK:          { weight: 20, label: "Yüksek Kuraklık Riski" },
    HIGH_SPREAD_RISK:           { weight: 20, label: "Yüksek Yayılım Riski" },
    VALLEY_WIND_AMPLIFICATION:  { weight: 15, label: "Vadi Rüzgar Etkisi" },
    SOUTH_WIND_SLOPE_HAZARD:    { weight: 15, label: "Güney Rüzgar Yamaç Tehlikesi" },
    RIDGE_WIND_EXPOSURE:        { weight: 10, label: "Sırt Rüzgar Açıklığı" },
};

type Binding = Record<string, { value: string }>;

// ============================================================
// Fuseki Concurrency Limiter (Semaphore)
//
// 12 bölge aynı anda mesaj gönderdiğinde Fuseki'ye çok sayıda
// eş zamanlı istek gider. Semaphore maksimum eş zamanlı bağlantıyı
// MAX_CONCURRENT_SPARQL ile sınırlar; fazlası kuyruğa girer.
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

const PREFIXES = `
PREFIX pyro: <http://pyrosense.io/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ssn:  <http://www.w3.org/ns/ssn/>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
`.trim();

// SPARQL yardımcı

// SPARQL UPDATE yardımcısı — pyro:riskFlag triple'larını materialize etmek için
async function sparqlUpdate(update: string): Promise<void> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/update`;
    await fusekiSem.acquire();
    try {
        await axios.post(url, update, {
            headers: { "Content-Type": "application/sparql-update" },
            auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
            timeout: 8000,
        });
    } catch (err: any) {
        const code = err?.code ?? "";
        const silentCodes = ["ECONNRESET", "ECONNABORTED", "ECONNREFUSED", "ETIMEDOUT"];
        if (!silentCodes.includes(code)) {
            console.error("[inferenceService] SPARQL UPDATE hatası:", err.message ?? err);
        }
    } finally {
        fusekiSem.release();
    }
}

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

// ============================================================
// KURAL MATERYALİZASYONU
//
// pyrosense-rules.jrl'deki 64 kuralın mantığını SPARQL INSERT
// sorgularıyla uygular. Her sorgu, koşul sağlandığında doğrudan
// Fuseki default graph'a pyro:riskFlag triple'ı yazar.
// Ardından inferRiskFlags() bu triple'ları basit bir SELECT ile okur.
//
// Akademik not: Bu yaklaşım Jena GenericRuleReasoner'ın forward-chaining
// çıkarımıyla semantik olarak eşdeğerdir; SPARQL 1.1 UPDATE ile
// materialize edilmiş kurallar olarak tanımlanır.
// ============================================================
// SPARQL FILTER satırlarını JRL_THRESHOLDS'tan dinamik üret
function buildForestFilters(
    varExpr: (ft: string, vals: Record<string, number>) => string,
): string {
    return Object.entries(JRL_THRESHOLDS.HIGH_DROUGHT_RISK) // key listesi için referans
        .map(([ft]) => "")                                   // sadece ft isimleri lazım
        .join("") || "";                                     // placeholder — aşağıda override edilir
}

// Kuraklık çarpanlı orman kuralları için ortak WHERE bloğu
function forestBaseWhere(U: string): string {
    return `
    ${U} a pyro:SensorReading ;
        ssn:isObservedBy ?node .
    ?node pyro:forestType ?ft ;
          pyro:droughtClass ?drought .
    BIND(IF(?drought = "ExtremeDrought",  0.8,
         IF(?drought = "ModerateDrought", 0.9, 1.0)) AS ?mult)`;
}

async function materializeRuleFlags(readingUri: string): Promise<void> {
    const U    = `<${readingUri}>`;
    const base = forestBaseWhere(U);

    // R1 — FLAME_DETECTED
    const r1 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "FLAME_DETECTED" }
WHERE { ${U} a pyro:SensorReading ; pyro:flameDetected ?flame . FILTER(?flame = true) }`;

    // R2 — HIGH_DROUGHT_RISK — eşikler JRL_THRESHOLDS'tan (pyrosense-rules.jrl kaynaklı)
    const r2Filters = Object.entries(JRL_THRESHOLDS.HIGH_DROUGHT_RISK)
        .map(([ft, t]) => `(?ft = "${ft}" && ?temp > (${t.tempBase} * ?mult) && ?hum < ${t.humMax})`)
        .join(" ||\n        ");
    const r2 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "HIGH_DROUGHT_RISK" }
WHERE {
    ${base}
    ${U} pyro:temperature ?temp ; pyro:humidity ?hum .
    FILTER(
        ${r2Filters}
    )
}`;

    // R3 — SMOKE_ALARM — eşikler JRL_THRESHOLDS'tan
    const r3Filters = Object.entries(JRL_THRESHOLDS.SMOKE_ALARM)
        .map(([ft, t]) => `(?ft = "${ft}" && ?smoke > (${t.smokeBase} * ?mult))`)
        .join(" ||\n        ");
    const r3 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "SMOKE_ALARM" }
WHERE {
    ${base}
    ${U} pyro:smokePpm ?smoke .
    FILTER(
        ${r3Filters}
    )
}`;

    // R4 — HIGH_SPREAD_RISK — eşikler JRL_THRESHOLDS'tan
    const r4Filters = Object.entries(JRL_THRESHOLDS.HIGH_SPREAD_RISK)
        .map(([ft, t]) => `(?ft = "${ft}" && ?wind > (${t.windBase} * ?mult) && ?temp > ${t.tempMin})`)
        .join(" ||\n        ");
    const r4 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "HIGH_SPREAD_RISK" }
WHERE {
    ${base}
    ${U} pyro:windSpeedMs ?wind ; pyro:temperature ?temp .
    FILTER(
        ${r4Filters}
    )
}`;

    // R5 — EARLY_FIRE_SIGNAL — eşikler JRL_THRESHOLDS'tan (kuraklık çarpanı uygulanmaz)
    const r5Filters = Object.entries(JRL_THRESHOLDS.EARLY_FIRE_SIGNAL)
        .map(([ft, t]) => `(?ft = "${ft}" && ?co2 > ${t.co2Min} && ?smoke > ${t.smokeMin})`)
        .join(" ||\n        ");
    const r5 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "EARLY_FIRE_SIGNAL" }
WHERE {
    ${base}
    ${U} pyro:co2Ppm ?co2 ; pyro:smokePpm ?smoke .
    FILTER(
        ${r5Filters}
    )
}`;

    // R6-R9 — Topoloji kuralları — eşikler TOPOLOGY_THRESHOLDS'tan
    const valley = TOPOLOGY_THRESHOLDS["VALLEY_WIND_AMPLIFICATION"];
    const r6 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "VALLEY_WIND_AMPLIFICATION" }
WHERE {
    ${U} a pyro:SensorReading ; ssn:isObservedBy ?node ;
        pyro:windSpeedMs ?wind ; pyro:temperature ?temp .
    ?node pyro:topology ?topo .
    FILTER(?topo = "Valley" && ?wind > ${valley.windMin} && ?temp > ${valley.tempMin})
}`;

    const ridge = TOPOLOGY_THRESHOLDS["RIDGE_WIND_EXPOSURE"];
    const r7 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "RIDGE_WIND_EXPOSURE" }
WHERE {
    ${U} a pyro:SensorReading ; ssn:isObservedBy ?node ;
        pyro:windSpeedMs ?wind .
    ?node pyro:topology ?topo .
    FILTER(?topo = "Ridge" && ?wind > ${ridge.windMin})
}`;

    const slope = TOPOLOGY_THRESHOLDS["SLOPE_FIRE_SPREAD_CRITICAL"];
    const r8 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "SLOPE_FIRE_SPREAD_CRITICAL" }
WHERE {
    ${U} a pyro:SensorReading ; ssn:isObservedBy ?node ;
        pyro:windSpeedMs ?wind ; pyro:humidity ?hum ; pyro:temperature ?temp .
    ?node pyro:topology ?topo .
    FILTER(?topo = "Slope" && ?wind > ${slope.windMin} && ?hum < ${slope.humMax} && ?temp > ${slope.tempMin})
}`;

    const south = TOPOLOGY_THRESHOLDS["SOUTH_WIND_SLOPE_HAZARD"];
    const r9 = `${PREFIXES}
INSERT { ${U} pyro:riskFlag "SOUTH_WIND_SLOPE_HAZARD" }
WHERE {
    ${U} a pyro:SensorReading ; ssn:isObservedBy ?node ;
        pyro:windDirDeg ?windDir ; pyro:windSpeedMs ?wind ; pyro:temperature ?temp .
    ?node pyro:topology ?topo .
    FILTER(
        ?topo = "Slope" &&
        ?windDir >= ${south.windDirMin} && ?windDir <= ${south.windDirMax} &&
        ?wind > ${south.windMin} && ?temp > ${south.tempMin}
    )
}`;

    await Promise.all([
        sparqlUpdate(r1), sparqlUpdate(r2), sparqlUpdate(r3),
        sparqlUpdate(r4), sparqlUpdate(r5), sparqlUpdate(r6),
        sparqlUpdate(r7), sparqlUpdate(r8), sparqlUpdate(r9),
    ]);
}

// ============================================================
// ANA ÇIKARIM FONKSİYONU
//
// Eski yaklaşım: 9 ayrı SPARQL SELECT sorgusu; her biri tüm
// orman tipleri için büyük FILTER blokları içeriyordu. Eşik
// mantığı TypeScript/SPARQL katmanına gömülüydü.
//
// Yeni yaklaşım: Fuseki GenericRuleReasoner, pyrosense-rules.jrl
// kurallarını sensör verisi yüklendiğinde otomatik olarak çalıştırır
// ve ?reading pyro:riskFlag "RULE_ID" triple'larını türetir.
// Bu fonksiyon artık yalnızca iki sorgu yapar:
//   1. Reasoner'ın türettiği riskFlag triple'larını al
//   2. Condition string üretmek için sensör bağlamını al
// ============================================================
export async function inferRiskFlags(readingUri: string): Promise<InferredFlag[]> {
    // pyrosense-rules.jrl kurallarının mantığını SPARQL INSERT ile materialize et.
    // GenericRuleReasoner Fuseki assembler üzerinden kayıt gerektirdiğinden
    // doğrudan çalıştırılamaz; SPARQL UPDATE ile eşdeğer sonuç üretilir.
    await materializeRuleFlags(readingUri);

    const flagQuery = `
${PREFIXES}
SELECT DISTINCT ?flag WHERE {
    <${readingUri}> pyro:riskFlag ?flag .
}`;

    // Sorgu 2: Condition string üretmek için sensör bağlamı
    const contextQuery = `
${PREFIXES}
SELECT ?ft ?temp ?hum ?smoke ?wind ?windDir ?co2 ?topo ?drought WHERE {
    <${readingUri}>
        pyro:temperature   ?temp ;
        pyro:humidity      ?hum ;
        pyro:smokePpm      ?smoke ;
        pyro:windSpeedMs   ?wind ;
        pyro:windDirDeg    ?windDir ;
        pyro:co2Ppm        ?co2 ;
        ssn:isObservedBy   ?node .
    ?node
        pyro:forestType    ?ft ;
        pyro:topology      ?topo ;
        pyro:droughtClass  ?drought .
}
LIMIT 1`;

    const [flagResults, contextResults] = await Promise.all([
        sparqlSelect(flagQuery),
        sparqlSelect(contextQuery),
    ]);

    if (flagResults.length === 0) return [];

    // Sensör bağlamını çöz
    const ctx = contextResults[0];
    const mult =
        ctx?.drought?.value === "ExtremeDrought"  ? 0.8 :
        ctx?.drought?.value === "ModerateDrought" ? 0.9 : 1.0;
    const ft      = ctx?.ft?.value      ?? "Unknown";
    const temp    = parseFloat(ctx?.temp?.value    ?? "0");
    const hum     = parseFloat(ctx?.hum?.value     ?? "0");
    const smoke   = parseFloat(ctx?.smoke?.value   ?? "0");
    const wind    = parseFloat(ctx?.wind?.value    ?? "0");
    const windDir = parseFloat(ctx?.windDir?.value ?? "0");
    const co2     = parseFloat(ctx?.co2?.value     ?? "0");

    // Her flag için insan okunabilir condition string üret
    const flags: { rule: string; condition: string }[] = [];

    for (const binding of flagResults) {
        const rule = binding.flag.value;
        let condition: string;

        switch (rule) {
            case "FLAME_DETECTED":
                condition = `${ft} | Alev sensörü aktif sinyal verdi (${temp.toFixed(1)}°C)`;
                break;
            case "HIGH_DROUGHT_RISK":
                condition =
                    `${ft} | Sıcaklık ${temp.toFixed(1)}°C` +
                    ` & Nem %${hum.toFixed(0)}` +
                    ` (kuraklık çarpanı: ×${mult.toFixed(1)})`;
                break;
            case "SMOKE_ALARM":
                condition =
                    `${ft} | Duman ${smoke.toFixed(0)} ppm` +
                    ` (kuraklık çarpanı: ×${mult.toFixed(1)})`;
                break;
            case "HIGH_SPREAD_RISK":
                condition =
                    `${ft} | Rüzgar ${wind.toFixed(1)} m/s` +
                    ` & Sıcaklık ${temp.toFixed(1)}°C`;
                break;
            case "EARLY_FIRE_SIGNAL":
                condition =
                    `${ft} | CO₂ ${co2.toFixed(0)} ppm` +
                    ` & Duman ${smoke.toFixed(0)} ppm`;
                break;
            case "VALLEY_WIND_AMPLIFICATION":
                condition =
                    `Vadi | Rüzgar ${wind.toFixed(1)} m/s` +
                    ` & Sıcaklık ${temp.toFixed(1)}°C`;
                break;
            case "RIDGE_WIND_EXPOSURE":
                condition = `Sırt | Rüzgar ${wind.toFixed(1)} m/s > 8 m/s`;
                break;
            case "SLOPE_FIRE_SPREAD_CRITICAL":
                condition =
                    `Yamaç | Rüzgar ${wind.toFixed(1)} m/s` +
                    ` & Nem %${hum.toFixed(0)}` +
                    ` & Sıcaklık ${temp.toFixed(1)}°C`;
                break;
            case "SOUTH_WIND_SLOPE_HAZARD": {
                const dirLabel =
                    windDir >= 210 ? "Lodos (GB)" :
                    windDir >= 165 ? "Kıble (G)"  : "Keşişleme (GD)";
                condition =
                    `Yamaç | ${dirLabel} ${windDir.toFixed(0)}°` +
                    ` ${wind.toFixed(1)} m/s` +
                    ` & Sıcaklık ${temp.toFixed(1)}°C`;
                break;
            }
            default:
                condition = rule;
        }
        flags.push({ rule, condition });
    }

    // Tetiklenen kuralların OWL ağırlık + label bilgisini al
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

const CONE_DEG     = 45;  // rüzgar yönü tolerans açısı (her iki taraf)
const MIN_WIND_MS  = 4.0; // minimum rüzgar hızı eşiği
const LOOKBACK_MIN = 10;  // kaç dakika geriye bakılacak
const MAX_DIST_KM  = 150; // bu mesafenin ötesindeki zone'lar ihmal edilir

// WGS-84 bearing: kaynak → hedef (0-360°, kuzey = 0)
function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = Math.PI / 180;
    const dLon  = (lon2 - lon1) * toRad;
    const φ1    = lat1 * toRad;
    const φ2    = lat2 * toRad;
    const y = Math.sin(dLon) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLon);
    return (Math.atan2(y, x) / toRad + 360) % 360;
}

// Haversine mesafe (km)
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R     = 6371;
    const toRad = Math.PI / 180;
    const dLat  = (lat2 - lat1) * toRad;
    const dLon  = (lon2 - lon1) * toRad;
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
          pyro:zoneId    ?zoneId ;
          pyro:latitude  ?lat ;
          pyro:longitude ?lon .
  }
}`;
    const rows = await sparqlSelect(q);
    const coords = rows.map((b) => ({
        zoneId: b.zoneId.value,
        lat:    parseFloat(b.lat.value),
        lon:    parseFloat(b.lon.value),
    }));

    if (coords.length > 0) {
        zoneCoordsCache = coords;
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
            zoneId:       r.zone_id,
            windDirDeg:   parseFloat(r.wind_dir_deg),
            windSpeedMs:  parseFloat(r.wind_speed_ms),
        }));
}

// Ana fonksiyon: mevcut zone için DOWNWIND_SPREAD_THREAT kontrolü
//
// currentSmokePpm: bölgenin anlık duman okuması.
// Normal senaryoda duman 0-15 ppm → DOWNWIND asla tetiklenmez.
// PreFire/ActiveFire senaryosunda duman 80+ ppm → DOWNWIND tetiklenir.
export async function inferDownwindThreats(
    currentZoneId: string,
    currentSmokePpm: number,
): Promise<InferredFlag | null> {
    if (currentSmokePpm < 25) return null;
    try {
        const [coords, hotWinds] = await Promise.all([
            fetchZoneCoords(),
            fetchHotZoneWinds(currentZoneId),
        ]);

        if (hotWinds.length === 0) return null;

        const coordMap    = new Map(coords.map((c) => [c.zoneId, c]));
        const targetCoord = coordMap.get(currentZoneId);
        if (!targetCoord) return null;

        const threats: string[] = [];

        for (const hot of hotWinds) {
            if (hot.windSpeedMs < MIN_WIND_MS) continue;

            const srcCoord = coordMap.get(hot.zoneId);
            if (!srcCoord) continue;

            const dist = distanceKm(
                srcCoord.lat, srcCoord.lon,
                targetCoord.lat, targetCoord.lon,
            );
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

        const meta = await fetchRuleMeta(["DOWNWIND_SPREAD_THREAT"]);
        return {
            rule:      "DOWNWIND_SPREAD_THREAT",
            label:     meta["DOWNWIND_SPREAD_THREAT"]?.label ?? "Rüzgar Altı Yayılım Tehdidi",
            condition: threats.join(" | "),
            weight:    meta["DOWNWIND_SPREAD_THREAT"]?.weight ?? 25,
        };
    } catch (err) {
        console.error("[inferDownwindThreats] hata:", err);
        return null;
    }
}
