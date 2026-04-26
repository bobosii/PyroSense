import { SensorMessage } from "../types/sensor";

const PYRO = "http://pyrosense.io/ontology#";
const SSN = "http://www.w3.org/ns/ssn/";
const XSD = "http://www.w3.org/2001/XMLSchema#";

function sanitize(v: number | undefined | null): number {
    if (v === null || v === undefined || isNaN(v as number) || !isFinite(v as number)) {
        return 0;
    }
    return v;
}

export function toRdfTurtle(
    msg: SensorMessage,
    droughtClass: string = "NormalMoisture",
): string {
    const nodeId = `${PYRO}${msg.device_id}`;
    const readId = `${PYRO}reading_${msg.device_id}_${msg.timestamp}`;

    return `
@prefix pyro: <${PYRO}> .
@prefix ssn:  <${SSN}> .
@prefix xsd:  <${XSD}> .

<${nodeId}> a pyro:SensorNode ;
    pyro:deviceId    "${msg.device_id}" ;
    pyro:zoneId    "${msg.zone_id}" ;
    pyro:forestType "${msg.forest_type}" ;
    pyro:topology "${msg.topology}" ;
    pyro:droughtClass "${droughtClass}" .

<${readId}> a pyro:SensorReading ;
    ssn:isObservedBy   <${nodeId}> ;
    pyro:temperature    "${sanitize(msg.readings.temperature)}"^^xsd:double ;
    pyro:humidity       "${sanitize(msg.readings.humidity)}"^^xsd:double ;
    pyro:smokePpm       "${sanitize(msg.readings.smoke_ppm)}"^^xsd:double ;
    pyro:windSpeedMs    "${sanitize(msg.readings.wind_speed_ms)}"^^xsd:double ;
    pyro:windDirDeg     "${sanitize(msg.readings.wind_dir_deg)}" ;
    pyro:uvIndex        "${sanitize(msg.readings.uv_index)}" ;
    pyro:co2Ppm         "${sanitize(msg.readings.co2_ppm ?? 0)}"^^xsd:double ;
    pyro:flameDetected  "${msg.readings.flame_detected}"^^xsd:boolean ;
    pyro:scenario       "${msg.scenario}" ;
    pyro:timestamp      "${msg.timestamp}"^^xsd:dateTime .
`.trim();
}
