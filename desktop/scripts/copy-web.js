// Copies the static frontend build (frontend/out) into desktop/web for packaging.

const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', '..', 'frontend', 'out');
const target = path.join(__dirname, '..', 'web');

if (!fs.existsSync(path.join(source, 'index.html'))) {
    console.error(`No frontend build found at ${source}. Run "npm run build" in frontend first.`);
    process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log(`Copied ${source} -> ${target}`);
