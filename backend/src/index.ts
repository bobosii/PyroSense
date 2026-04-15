import { startMqttConsumer } from "./services/mqttConsumer";
import { startWsGateway } from "./services/wsGateway";

console.log("Pyrosense backend is running now");
startWsGateway();
startMqttConsumer();
