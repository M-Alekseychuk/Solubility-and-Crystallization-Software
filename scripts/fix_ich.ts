import fs from 'fs';
let content = fs.readFileSync('src/data/solvents.ts', 'utf-8');
content = content.replace(/("name":\s*"Water"[\s\S]*?"ichClass":\s*)3/g, `$1""`);
fs.writeFileSync('src/data/solvents.ts', content);
console.log('Fixed Water ICH Class');
