const fs = require('fs');
const path = require('path');

const walkSync = (dir, callback) => {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walkSync(filepath, callback);
    } else if (stats.isFile() && /\.(ts|tsx|js|jsx)$/.test(filepath)) {
      callback(filepath);
    }
  });
};

const replacements = [
  { search: /"@\/components\//g, replace: '"@/shared/ui/' },
  { search: /'@\/components\//g, replace: "'@/shared/ui/" },
  { search: /"@\/hooks\//g, replace: '"@/shared/hooks/' },
  { search: /'@\/hooks\//g, replace: "'@/shared/hooks/" },
  { search: /"@\/constants\//g, replace: '"@/shared/constants/' },
  { search: /'@\/constants\//g, replace: "'@/shared/constants/" },
  { search: /"@\/lib\//g, replace: '"@/shared/lib/' },
  { search: /'@\/lib\//g, replace: "'@/shared/lib/" },
];

walkSync('src', (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let newContent = content;
  
  for (const { search, replace } of replacements) {
    newContent = newContent.replace(search, replace);
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filepath, newContent, 'utf8');
    console.log(`Updated ${filepath}`);
  }
});
