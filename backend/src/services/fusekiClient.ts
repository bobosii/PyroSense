import axios from "axios";
import { FUSEKI_URL, FUSEKI_DATASET, FUSEKI_USER, FUSEKI_PASSWORD } from "../constants";

export async function uploadTurtle(turtle: string): Promise<void> {
    const url = `${FUSEKI_URL}/${FUSEKI_DATASET}/data`;

    await axios.post(url, turtle, {
        headers: { "Content-Type": "text/turtle" },
        auth: { username: FUSEKI_USER, password: FUSEKI_PASSWORD },
    });
}
