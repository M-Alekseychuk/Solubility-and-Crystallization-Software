import fs from 'fs';
const css = fs.readFileSync('src/index.css', 'utf8');
console.log(css.includes('oklch'));
