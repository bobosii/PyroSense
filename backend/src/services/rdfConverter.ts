import { SensorMessage } from "../types/sensor";

const PYRO = "http://pyrosense.io/ontology#";
const SSN = "http://www.w3.org/ns/ssn/";
const XSD = "http://www.w3.org/2001/XMLSchema#";

export function toRdfTurtle(msg: SensorMessage): string {
    const nodeId = `${PYRO}${msg.device_id}`;
    const readId = `${PYRO}reading_${msg.device_id}_${msg.timestamp}`;

    return `
@prefix pyro: <${PYRO}> .
@prefix ssn:  <${SSN}> .
@prefix xsd:  <${XSD}> .

<${nodeId}> a pyro:SensorNode ;
    pyro:deviceId    "${msg.device_id}" ;
    pyro:zoneId    "${msg.zone_id}" ;
    pyro:forestType "${msg.forest_type}" .

<${readId}> a pyro:SensorReading ;
    ssn:isObservedBy   <${nodeId}> ;
    pyro:temperature    "${msg.readings.temperature}"^^xsd:double ;
    pyro:humidity       "${msg.readings.humidity}"^^xsd:double ;
    pyro:smokePpm       "${msg.readings.smoke_ppm}"^^xsd:double ;
    pyro:windSpeedMs    "${msg.readings.wind_speed_ms}"^^xsd:double ;
    pyro:windDirDeg     "${msg.readings.wind_dir_deg}" ;
    pyro:uvIndex        "${msg.readings.uv_index}"  ;
    pyro:co2Ppm         "${msg.readings.co2_ppm}"^^xsd:double ;
    pyro:flameDetected  "${msg.readings.flame_detected}"^^xsd:boolean ;
    pyro:scenario       "${msg.scenario}" ;
    pyro:timestamp      "${msg.timestamp}"^^xsd:dateTime .
`.trim();
}
