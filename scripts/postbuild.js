const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const src = path.join(projectRoot, 'dist', 'pixel-pet.exe');
const dest = path.join(projectRoot, '..', 'pixel-pet.exe');

fs.copyFileSync(src, dest);
console.log(`Copied installer to ${dest}`);
