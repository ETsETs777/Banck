import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "resources", "app-icon.svg");

const svg = fs.readFileSync(svgPath);
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 512 },
});
const buf = resvg.render().asPng();

fs.mkdirSync(path.join(root, "public"), { recursive: true });
const targets = [
  path.join(root, "resources", "app-icon.png"),
  path.join(root, "public", "app-icon.png"),
];
for (const p of targets) {
  fs.writeFileSync(p, buf);
}
fs.copyFileSync(svgPath, path.join(root, "public", "app-icon.svg"));
console.log("[spektors-desktop] icons:", targets.join(", "), `(${buf.length} bytes)`);
