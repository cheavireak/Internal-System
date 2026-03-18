import { db } from "./src/db.js";

async function checkUser() {
  const email = "admin@admin.com"; // Change if needed
  try {
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    console.log("User data:", user);
  } catch (error) {
    console.error("Error:", error);
  }
}

checkUser();
