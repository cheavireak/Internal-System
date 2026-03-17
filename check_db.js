import { db } from "./src/db.js";
const setting = db.prepare("SELECT value FROM system_settings WHERE key = 'session_timeout'").get();
console.log(setting);
