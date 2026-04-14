import { MongoClient, Db } from "mongodb";
import { MONGO_URL } from "../constants";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongo(): Promise<Db> {
    if (!db) {
        client = new MongoClient(MONGO_URL);
        await client.connect();

        db = client.db("pyrosense");
        console.log("MongoDB connected");
    }
    return db;
}
