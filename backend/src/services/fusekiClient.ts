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
        await axios.post(
            url,
            "update=CLEAR%20DEFAULT",
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
            },
        );
        console.log("[FUSEKI] Default graph temizlendi");
    } catch (err) {
        console.error("[FUSEKI] Temizlik hatası:", err);
    }
}

export async function loadOntology(): Promise<void> {
    const owlPath = path.resolve(__dirname, "../../../ontology/pyrosense-core.owl");
    const turtle = fs.readFileSync(owlPath, "utf-8");

    // PUT - named graph'a yazalim, her restart da uzerine yazalim bu sayede duplicate ihtimalini eleyelim
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/data?graph=${encodeURIComponent(ONTOLOGY_GRAPH)}`;
    await axios.put(url, turtle, {
        headers: { "Content-Type": "text/turtle" },
        auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
    });

    console.log("[FUSEKI] Ontoloji yuklendi - RiskRule aktif");
}
