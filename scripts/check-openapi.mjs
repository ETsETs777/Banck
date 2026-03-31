/**
 * Генерация OpenAPI-схемы без запуска сервера (cwd = apps/api).
 * Использует venv в apps/api, если есть; иначе py -3 (Windows) или python3.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");
const code = "from spektors_api.main import app; app.openapi()";

const winVenv = join(apiDir, ".venv", "Scripts", "python.exe");
const unixVenv = join(apiDir, ".venv", "bin", "python");

let command;
let args;

if (existsSync(winVenv)) {
  command = winVenv;
  args = ["-c", code];
} else if (existsSync(unixVenv)) {
  command = unixVenv;
  args = ["-c", code];
} else if (process.platform === "win32") {
  command = "py";
  args = ["-3", "-c", code];
} else {
  command = "python3";
  args = ["-c", code];
}

const r = spawnSync(command, args, {
  cwd: apiDir,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
