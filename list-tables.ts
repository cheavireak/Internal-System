import { db } from "./src/db.js";

async function listTables() {
  const tables = await db.prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'").all();
  console.log("Tables:", tables);
}

listTables();
