import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

const filesToCopy = [
  "index.html",
  "app.html",
  "manifest.json",
  "service-worker.js",
  "supabase-data.js",
  "owner-ui.js",
  "master_stock.xlsx",
  "icon.svg",
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const relativePath of filesToCopy) {
  const source = path.join(root, relativePath);
  const destination = path.join(dist, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing deploy asset: ${relativePath}`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

console.log(`Cloudflare bundle ready in ${dist}`);
