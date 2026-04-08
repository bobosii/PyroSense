import axios from "axios";

const FUSEKI_URL = process.env.FUSEKI_URL || "http://localhost:3030";
const FUSEKI_DATASET = process.env.FUSEKI_DATASET || "pyrosense";
const FUSEKI_USER = process.env.FUSEKI_USER || "admin";
const FUSEKI_PASSWORD = process.env.FUSEKI_PASSWORD || "pyrosense123";

export async function uploadTurtle(turtle: string): Promise<void> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/data`;

    await axios.post(url, turtle, {
        headers: { "Content-Type": "text/turtle" },
        auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
    });
}
