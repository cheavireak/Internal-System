import { db } from "./src/db.js";

async function checkSettings() {
  const settings = await db.prepare("SELECT * FROM system_settings").all();
  console.log("Settings:", settings);
}

checkSettings();
