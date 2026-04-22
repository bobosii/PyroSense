import { startMqttConsumer } from "./services/mqttConsumer";
import { startWsGateway } from "./services/wsGateway";
import { fetchAllZones } from "./services/weatherService";
import { saveWeatherCache, updateZoneDrought } from "./services/weatherRepository";
import { startHttpServer } from "./services/httpServer";

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

console.log("Pyrosense backend is running now");
startWsGateway();
startMqttConsumer();

// İlk fetch hemen, sonra her saat
runWeatherFetch();
setInterval(runWeatherFetch, 60 * 60 * 1000);
startHttpServer();
