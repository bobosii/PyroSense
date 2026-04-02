const getEnvVar = (key: string) => {
    const parameter = process.env[key];
    if (!parameter) {
        throw new Error(`Missing environment variable ${key}`);
    } else {
        return parameter;
    }
};

export const MQTT_URL = getEnvVar("MQTT_URL");
