const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.ts')) {
      const content = fs.readFileSync(p, 'utf8');
      if (content.includes('await await')) {
        fs.writeFileSync(p, content.replace(/await await/g, 'await'));
        console.log(`Fixed ${p}`);
      }
    }
  });
}

walk('src/routes');
