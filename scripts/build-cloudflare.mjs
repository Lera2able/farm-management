import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

// Everything the app needs to run, install as a PWA, and work offline.
// Missing files are skipped with a warning instead of failing the build,
// so a pending asset (e.g. icons being uploaded separately) can't break deploys.
const filesToCopy = [
  "index.html",
  "app.html",
  "admin.html",
  "manifest.json",
  "service-worker.js",
  "db.js",
  "sync.js",
  "supabase-data.js",
  "owner-ui.js",
  "app.js",
  "livestock-data.js",
  "styles.css",
  "master_stock.xlsx",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
];

const dirsToCopy = ["assets"];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

let copied = 0;
for (const relativePath of filesToCopy) {
  const source = path.join(root, relativePath);
  const destination = path.join(dist, relativePath);

  if (!fs.existsSync(source)) {
    console.warn(`Skipping missing asset: ${relativePath}`);
    continue;
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  copied++;
}

for (const dir of dirsToCopy) {
  const source = path.join(root, dir);
  if (fs.existsSync(source)) {
    fs.cpSync(source, path.join(dist, dir), { recursive: true });
    console.log(`Copied directory: ${dir}`);
  }
}

console.log(`Cloudflare bundle ready in ${dist} (${copied} files)`);
