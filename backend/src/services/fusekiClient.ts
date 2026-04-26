import axios from "axios";
import { FUSEKI_URL, FUSEKI_DATASET, FUSEKI_USER, FUSEKI_PASSWORD } from "../constants";
import path from "path";
import fs from "fs";

export async function uploadTurtle(turtle: string): Promise<void> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/data`;

    await axios.post(url, turtle, {
        headers: { "Content-Type": "text/turtle" },
        auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
    });
}

export async function loadOntology(): Promise<void> {
    const owlPath = path.resolve(__dirname, "../../../ontology/pyrosense-core.owl");
    const turtle = fs.readFileSync(owlPath, "utf-8");
    await uploadTurtle(turtle);
    console.log("[FUSEKI] Ontoloji yuklendi - RiskRule aktif");
}
