import { db } from "./src/db.js";
db.prepare("UPDATE system_settings SET value = '{\"value\":\"\",\"enabled\":false}' WHERE key = 'ip_whitelist'").run();
console.log("IP Whitelist disabled.");
