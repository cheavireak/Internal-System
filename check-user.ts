import { db } from "./src/db.js";

async function checkUser() {
  const user = await db.prepare("SELECT * FROM users WHERE email = ?").get("cheavireak2021@gmail.com");
  console.log("User:", user);
}

checkUser();
