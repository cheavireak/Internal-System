import { db, initSchema } from "./src/db.js";
import bcrypt from "bcryptjs";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

async function createAdmin() {
  await initSchema(); // Ensure tables exist
  
  const rl = readline.createInterface({ input, output });

  try {
    const email = await rl.question("Enter admin email: ");
    const password = await rl.question("Enter admin password: ");
    
    if (!email || !password) {
      console.error("Email and password are required.");
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingUser) {
      console.log("User with this email already exists.");
      return;
    }

    await db.prepare(`
      INSERT INTO users (email, password_hash, role, name, is_superadmin, permissions)
      VALUES (?, ?, 'admin', 'Admin User', true, '[]')
    `).run(email, hashedPassword);
    
    console.log("Super admin user created successfully!");
  } catch (error) {
    console.error("Error creating admin user:", error);
  } finally {
    rl.close();
  }
}

createAdmin();
