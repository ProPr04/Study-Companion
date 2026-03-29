import pkg from "pg";
import "../config/env.js";

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;
