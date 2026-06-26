import { pool } from './src/db.js';

async function test() {
  const usersType = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`);
  console.log('users columns:', usersType.rows.filter(r => ['is_superadmin', 'is_disabled'].includes(r.column_name)));
  
  const customersType = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers'`);
  console.log('customers columns:', customersType.rows.filter(r => r.column_name === 'is_imported'));
  
  process.exit(0);
}
test();
