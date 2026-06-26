import { pool } from './src/db.js';
async function run() {
  try {
    await pool.query('ALTER TABLE users ALTER COLUMN is_superadmin DROP DEFAULT;');
    await pool.query('ALTER TABLE users ALTER COLUMN is_superadmin TYPE boolean USING (CASE WHEN is_superadmin=1 THEN TRUE ELSE FALSE END);');
    await pool.query('ALTER TABLE users ALTER COLUMN is_superadmin SET DEFAULT FALSE;');

    await pool.query('ALTER TABLE users ALTER COLUMN is_disabled DROP DEFAULT;');
    await pool.query('ALTER TABLE users ALTER COLUMN is_disabled TYPE boolean USING (CASE WHEN is_disabled=1 THEN TRUE ELSE FALSE END);');
    await pool.query('ALTER TABLE users ALTER COLUMN is_disabled SET DEFAULT FALSE;');

    await pool.query('ALTER TABLE customers ALTER COLUMN is_imported DROP DEFAULT;');
    await pool.query('ALTER TABLE customers ALTER COLUMN is_imported TYPE boolean USING (CASE WHEN is_imported=1 THEN TRUE ELSE FALSE END);');
    await pool.query('ALTER TABLE customers ALTER COLUMN is_imported SET DEFAULT FALSE;');
    console.log("Reverted columns to boolean");
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
