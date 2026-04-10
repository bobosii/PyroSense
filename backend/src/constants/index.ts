import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const getEnvVar = (key: string) => {
    const parameter = process.env[key];
    if (!parameter) {
        throw new Error(`Missing environment variable ${key}`);
    } else {
        return parameter;
    }
};

// MQTT
export const MQTT_URL = getEnvVar("MQTT_URL");

// Fuseki
export const FUSEKI_URL = getEnvVar("FUSEKI_URL");
export const FUSEKI_DATASET = getEnvVar("FUSEKI_DATASET");
export const FUSEKI_USER = getEnvVar("FUSEKI_USER");
export const FUSEKI_PASSWORD = getEnvVar("FUSEKI_PASSWORD");

// PostgreSQL
export const DATABASE_URL = getEnvVar("DATABASE_URL");

// MongoDB
export const MONGO_URL = getEnvVar("MONGO_URL");
