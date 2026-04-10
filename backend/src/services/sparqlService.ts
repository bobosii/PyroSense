import axios from "axios";
import { FUSEKI_URL, FUSEKI_DATASET, FUSEKI_USER, FUSEKI_PASSWORD } from "../constants";

// Bu servis verilen bir reading uri icin Fuseki'ye sparql select sorugusu gonderecek.

export interface SparqlReading {
    temperature: number;
    humidity: number;
    smokePpm: number;
    windSpeedMs: number;
    co2Ppm: number;
    flameDetected: boolean;
    forestType: string;
    topology: string;
}

export async function queryReading(readingUri: string): Promise<SparqlReading | null> {
    const query = `
    PREFIX pyro: <http://pyrosense.io/ontology#>
    PREFIX ssn:  <http://www.w3.org/ns/ssn/>
    PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>

    SELECT ?temp ?hum ?smoke ?wind ?co2 ?flame ?forestType ?topology
    WHERE {
    <${readingUri}> pyro:temperature  ?temp ;
                      pyro:humidity     ?hum ;
                      pyro:smokePpm     ?smoke ;
                      pyro:windSpeedMs  ?wind ;
                      pyro:co2Ppm       ?co2 ;
                      pyro:flameDetected ?flame ;
                      ssn:isObservedBy  ?node .
    ?node pyro:forestType ?forestType ;
            pyro:topology   ?topology .
    }
    LIMIT 1
    `;

    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/sparql`;

    const response = await axios.get(url, {
        params: { query },
        headers: { Accept: "application/sparql-results+json" },
        auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
    });

    const bindings = response.data.results.bindings;

    if (!bindings || bindings.length === 0) return null;

    const b = bindings[0];

    return {
        temperature: parseFloat(b.temp.value),
        humidity: parseFloat(b.hum.value),
        smokePpm: parseFloat(b.smoke.value),
        windSpeedMs: parseFloat(b.wind.value),
        co2Ppm: parseFloat(b.co2.value),
        flameDetected: b.flame.value === "true",
        forestType: b.forestType.value,
        topology: b.topology.value,
    };
}
