import { db } from "./src/db.js";

async function listUsers() {
  const users = await db.prepare("SELECT email, role, is_superadmin FROM users").all();
  console.log("Users:", users);
}

listUsers();
