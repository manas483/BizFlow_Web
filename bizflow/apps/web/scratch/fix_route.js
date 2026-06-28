const fs = require('fs');
const file = 'c:\\Users\\sacha\\Desktop\\B\\bizflow\\apps\\web\\src\\app\\api\\sales\\[id]\\route.ts';
let content = fs.readFileSync(file, 'utf8');

// Replace \` with `
content = content.replace(/\\`/g, '`');
// Replace \${ with ${
content = content.replace(/\\\${/g, '${');

fs.writeFileSync(file, content);
console.log('Fixed backslashes');
