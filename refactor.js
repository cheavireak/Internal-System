import fs from 'fs';
import path from 'path';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Make route handlers async
  content = content.replace(/router\.(get|post|put|delete)\((['"`].*?['"`]),\s*([^,]+,\s*)?([^,]+,\s*)?\((req: any, res|req, res)\) => \{/g, 'router.$1($2, $3$4async ($5) => {');
  content = content.replace(/router\.(get|post|put|delete)\((['"`].*?['"`]),\s*([^,]+,\s*)?([^,]+,\s*)?async \((req: any, res|req, res)\) => \{/g, 'router.$1($2, $3$4async ($5) => {'); // prevent double async

  // Add await to db.prepare().get()
  content = content.replace(/(?<!await\s)db\.prepare\((.*?)\)\.get\((.*?)\)/g, 'await db.prepare($1).get($2)');
  content = content.replace(/(?<!await\s)db\.prepare\((.*?)\)\.all\((.*?)\)/g, 'await db.prepare($1).all($2)');
  content = content.replace(/(?<!await\s)db\.prepare\((.*?)\)\.run\((.*?)\)/g, 'await db.prepare($1).run($2)');

  // Handle cases with no arguments
  content = content.replace(/(?<!await\s)db\.prepare\((.*?)\)\.get\(\)/g, 'await db.prepare($1).get()');
  content = content.replace(/(?<!await\s)db\.prepare\((.*?)\)\.all\(\)/g, 'await db.prepare($1).all()');
  content = content.replace(/(?<!await\s)db\.prepare\((.*?)\)\.run\(\)/g, 'await db.prepare($1).run()');

  // Fix bcrypt.compareSync to await bcrypt.compare
  content = content.replace(/bcrypt\.compareSync\((.*?),\s*(.*?)\)/g, 'await bcrypt.compare($1, $2)');
  
  // Fix handleFailedLogin in auth.ts to be async
  content = content.replace(/const handleFailedLogin = \((.*?)\) => \{/g, 'const handleFailedLogin = async ($1) => {');
  content = content.replace(/return handleFailedLogin/g, 'return await handleFailedLogin');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir('./src/routes');
processFile('./src/utils/audit.ts');
processFile('./src/scheduler.ts');
