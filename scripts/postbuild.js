const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const src = path.join(projectRoot, 'dist', 'clawd-pet.exe');
const dest = path.join(projectRoot, '..', 'clawd-pet.exe');

fs.copyFileSync(src, dest);
console.log(`Copied installer to ${dest}`);
