import { startMqttConsumer } from "./services/mqttConsumer";
import { startWsGateway } from "./services/wsGateway";
import { fetchAllZones } from "./services/weatherService";
import { saveWeatherCache, updateZoneDrought } from "./services/weatherRepository";
import { startHttpServer } from "./services/httpServer";
import { loadOntology, clearDefaultGraph } from "./services/fusekiClient";

async function runWeatherFetch() {
    console.log("[WEATHER] Guncelleniyor...");

    const results = await fetchAllZones();
    for (const data of results) {
        await saveWeatherCache(data);
        await updateZoneDrought(data.zoneId, data.droughtClass);
        console.log(
            `[WEATHER] ${data.zoneId}: ${data.droughtClass} | yagis=${data.precipitation30d}mm`,
        );
    }
}
async function main() {
    console.log("Pyrosense backend is running now");

    await loadOntology();

    startWsGateway();
    startMqttConsumer();

    // İlk fetch hemen, sonra her saat
    runWeatherFetch();
    setInterval(runWeatherFetch, 60 * 60 * 1000);

    // Fuseki default graph temizliği — her 2 saatte bir
    // OWL named graph'a (<http://pyrosense.io/ontology>) dokunmaz
    const CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000;
    setInterval(clearDefaultGraph, CLEANUP_INTERVAL_MS);
    console.log(`[FUSEKI] Otomatik temizlik: her ${CLEANUP_INTERVAL_MS / 3600000} saatte bir`);

    startHttpServer();
}
main().catch(console.error);
