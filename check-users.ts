import { db } from "./src/db.js";

async function checkUsers() {
  try {
    const users = await db.prepare("SELECT * FROM users").all();
    console.log("Users:", users);
  } catch (e) {
    console.error("Error:", e);
  }
}

checkUsers();
