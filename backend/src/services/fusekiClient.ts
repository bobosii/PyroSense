import axios from "axios";
import {
    FUSEKI_URL,
    FUSEKI_DATASET,
    FUSEKI_USER,
    FUSEKI_PASSWORD,
    ONTOLOGY_GRAPH,
} from "../constants";
import path from "path";
import fs from "fs";

export async function uploadTurtle(turtle: string): Promise<void> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/data`;

    await axios.post(url, turtle, {
        headers: { "Content-Type": "text/turtle" },
        auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
    });
}

// Default graph'taki sensör verilerini temizle (OWL named graph'a dokunmaz)
export async function clearDefaultGraph(): Promise<void> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/update`;
    try {
        await axios.post(url, "update=CLEAR%20DEFAULT", {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
        });
        console.log("[FUSEKI] Default graph temizlendi");
    } catch (err) {
        console.error("[FUSEKI] Temizlik hatası:", err);
    }
}

// Fuseki'nin hazır olmasını bekle (max maxWaitSecs saniye)
async function waitForFuseki(maxWaitSecs = 60): Promise<void> {
    const pingUrl = `${FUSEKI_URL}/$/ping`;
    const deadline = Date.now() + maxWaitSecs * 1000;

    while (Date.now() < deadline) {
        try {
            await axios.get(pingUrl, {
                auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
                timeout: 3000,
            });
            console.log("[FUSEKI] Hazır ✓");
            return;
        } catch {
            console.log("[FUSEKI] Bekleniyor...");
            await new Promise((r) => setTimeout(r, 3000));
        }
    }
    throw new Error(`[FUSEKI] ${maxWaitSecs}s içinde yanıt vermedi`);
}

// FUSEKI_DATASET env var ile başlatılan Fuseki dataseti read-only oluşabilir.
// Admin API ile dataseti silip dbType=mem ile yeniden oluşturuyoruz.
// dbType=mem: /sparql, /query, /update, /data (rw), /get (r) — hepsini açar.
async function ensureDatasetWritable(): Promise<void> {
    const auth = { username: FUSEKI_USER, password: FUSEKI_PASSWORD };

    // Mevcut dataseti sil (read-only olabilir)
    try {
        await axios.delete(`${FUSEKI_URL}/$/datasets/${FUSEKI_DATASET}`, {
            auth,
            timeout: 5000,
        });
        console.log(`[FUSEKI] Eski dataset silindi`);
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
            console.log("[FUSEKI] Dataset zaten yok, oluşturulacak");
        } else {
            console.log(`[FUSEKI] Dataset silinirken hata (devam): HTTP ${status}`);
        }
    }

    // Tüm endpoint'ler açık (rw) olarak yeniden oluştur
    await axios.post(`${FUSEKI_URL}/$/datasets`, `dbName=${FUSEKI_DATASET}&dbType=mem`, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth,
        timeout: 10000,
    });
    console.log(`[FUSEKI] Dataset '${FUSEKI_DATASET}' yazma erişimiyle oluşturuldu ✓`);
}

// Turtle → SPARQL UPDATE dönüşümü
// GSP PUT/POST yerine /update endpoint'ini kullanır — her Fuseki konfigürasyonunda çalışır.
// Tek dönüşüm: "@prefix X: <Y> ." → "PREFIX X: <Y>"
// Geri kalan Turtle sözdizimi SPARQL INSERT DATA ile birebir uyumlu.
function buildSparqlUpdate(turtle: string, graphUri: string): string {
    const prefixLines: string[] = [];
    const tripleLines: string[] = [];

    for (const line of turtle.split("\n")) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("@prefix")) {
            // @prefix foo: <bar> .  →  PREFIX foo: <bar>
            prefixLines.push(
                trimmed.replace(/^@prefix\s+/, "PREFIX ").replace(/\s*\.\s*$/, ""),
            );
        } else if (trimmed.startsWith("@base")) {
            prefixLines.push(
                trimmed.replace(/^@base\s+/, "BASE ").replace(/\s*\.\s*$/, ""),
            );
        } else {
            tripleLines.push(line);
        }
    }

    return [
        prefixLines.join("\n"),
        "",
        `CLEAR SILENT GRAPH <${graphUri}> ;`,
        "",
        "INSERT DATA {",
        `  GRAPH <${graphUri}> {`,
        tripleLines.join("\n"),
        "  }",
        "}",
    ].join("\n");
}

export async function loadOntology(): Promise<void> {
    // Fuseki tamamen ayağa kalkana kadar bekle
    await waitForFuseki(60);

    // Dataset'i write erişimiyle yeniden oluştur
    await ensureDatasetWritable();

    const owlPath = path.resolve(__dirname, "../../../ontology/pyrosense-core.owl");
    const turtle = fs.readFileSync(owlPath, "utf-8");

    // Turtle'ı SPARQL UPDATE'e çevir ve /update endpoint'i üzerinden yükle.
    // Bu yaklaşım GSP PUT/POST'a hiç bağlı değildir; her Fuseki konfigürasyonunda çalışır.
    const sparqlUpdate = buildSparqlUpdate(turtle, ONTOLOGY_GRAPH);
    const updateUrl = `${FUSEKI_URL}/${FUSEKI_DATASET}/update`;

    const MAX_RETRIES = 5;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await axios.post(updateUrl, sparqlUpdate, {
                headers: { "Content-Type": "application/sparql-update" },
                auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
                timeout: 30000,
            });
            // Named graph'a kaç triple yüklendiğini doğrula
            try {
                const countQ = `SELECT (COUNT(*) AS ?n) WHERE { GRAPH <${ONTOLOGY_GRAPH}> { ?s ?p ?o } }`;
                const cv = await axios.get(`${FUSEKI_URL}/${FUSEKI_DATASET}/sparql`, {
                    params: { query: countQ },
                    headers: { Accept: "application/sparql-results+json" },
                    auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
                    timeout: 10000,
                });
                const n = parseInt(cv.data?.results?.bindings?.[0]?.n?.value ?? "0", 10);
                console.log(`[FUSEKI] Ontoloji yüklendi ✓ — ${n} triple, RiskRule aktif`);
            } catch {
                console.log("[FUSEKI] Ontoloji yüklendi ✓ — RiskRule aktif");
            }
            return;
        } catch (err: any) {
            const status = err?.response?.status;
            const detail = err?.response?.data ?? "";
            console.error(
                `[FUSEKI] loadOntology denemesi ${attempt}/${MAX_RETRIES} başarısız` +
                    ` (HTTP ${status ?? "bağlantı hatası"}) ${detail}`,
            );
            if (attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 3000 * attempt));
            }
        }
    }
    throw new Error("[FUSEKI] Ontoloji yüklenemedi — tüm denemeler tükendi");
}
