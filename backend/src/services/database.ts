import { Pool } from "pg";
import { DATABASE_URL } from "../constants";

let pool: Pool | null = null;

export function getDb(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: DATABASE_URL,
        });
        console.log(`Database url: ${DATABASE_URL}`);
        pool.on("error", (err) => {
            console.log(`Unexpected error while connecting PostgreSQL: ${err}`);
        });
    }
    return pool;
}
