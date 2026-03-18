import { db } from "./src/db.js";

async function checkUsers() {
  const users = await db.prepare("SELECT email FROM users").all();
  console.log("Users in DB:", users);
}

checkUsers();
