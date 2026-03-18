const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Replace stmt.run( with await stmt.run(
  content = content.replace(/(\s+)(stmt\.run\()/g, '$1await $2');
  
  // Replace dbResult = stmt.run( with dbResult = await stmt.run(
  content = content.replace(/(\s+const\s+\w+\s*=\s*)(stmt\.run\()/g, '$1await $2');
  content = content.replace(/(\s+let\s+\w+\s*=\s*)(stmt\.run\()/g, '$1await $2');
  content = content.replace(/(\s+\w+\s*=\s*)(stmt\.run\()/g, '$1await $2');

  // Replace db.prepare(...).run( with await db.prepare(...).run(
  content = content.replace(/(\s+)(db\.prepare\([^)]+\)\.run\()/g, '$1await $2');
  content = content.replace(/(\s+)(dbModule\.db\.prepare\([^)]+\)\.run\()/g, '$1await $2');

  // Replace db.prepare(...).all( with await db.prepare(...).all(
  content = content.replace(/(\s+)(db\.prepare\([^)]+\)\.all\()/g, '$1await $2');
  
  // Replace `).run( with `).run( -> await `).run(
  content = content.replace(/(\s+`\)\.run\()/g, '$1'.replace('`', 'await `'));
  
  // Replace `).all( with `).all( -> await `).all(
  content = content.replace(/(\s+`\)\.all\()/g, '$1'.replace('`', 'await `'));

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
