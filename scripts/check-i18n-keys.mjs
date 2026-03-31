/**
 * Сравнивает наборы ключей во всех *.json локали каждого приложения в @spektors/messages.
 * Эталон — ru.json (если есть), иначе первый файл по имени.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages", "messages", "locales");

function flattenKeys(obj, prefix = "") {
  const keys = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return keys;
  }
  for (const k of Object.keys(obj).sort()) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, p));
    } else {
      keys.push(p);
    }
  }
  return keys;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

let failed = false;

for (const app of readdirSync(localesDir, { withFileTypes: true }).filter(
  (d) => d.isDirectory(),
)) {
  const appName = app.name;
  const appPath = join(localesDir, appName);
  const files = readdirSync(appPath)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length < 2) {
    console.warn(`skip ${appName}: need at least 2 locale files`);
    continue;
  }

  const refName = files.includes("ru.json") ? "ru.json" : files[0];
  const refPath = join(appPath, refName);
  const refKeys = new Set(flattenKeys(loadJson(refPath)));

  for (const fname of files) {
    if (fname === refName) continue;
    const otherPath = join(appPath, fname);
    const otherKeys = new Set(flattenKeys(loadJson(otherPath)));
    const onlyRef = [...refKeys].filter((k) => !otherKeys.has(k));
    const onlyOther = [...otherKeys].filter((k) => !refKeys.has(k));
    if (onlyRef.length || onlyOther.length) {
      failed = true;
      console.error(`\n[${appName}] ${refName} vs ${fname}:`);
      if (onlyRef.length) console.error(`  only in ${refName}:`, onlyRef.join(", "));
      if (onlyOther.length) console.error(`  only in ${fname}:`, onlyOther.join(", "));
    }
  }
}

if (failed) {
  console.error("\ncheck-i18n-keys: failed");
  process.exit(1);
}
console.log("check-i18n-keys: ok");
