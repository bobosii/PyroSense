import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
        console.log(`Database url: ${process.env.DATABASE_URL}`);
        pool.on("error", (err) => {
            console.log(`Unexpected error while connecting PostgreSQL: ${err}`);
        });
    }
    return pool;
}
