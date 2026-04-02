import { startMqttConsumer } from "./services/mqttConsumer";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

console.log("Pyrosense backend is running now");
startMqttConsumer();
