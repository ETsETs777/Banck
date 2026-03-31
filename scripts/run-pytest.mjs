/**
 * Запуск pytest для apps/api (venv в apps/api или py -3 / python3).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");
const winVenv = join(apiDir, ".venv", "Scripts", "python.exe");
const unixVenv = join(apiDir, ".venv", "bin", "python");

let command;
let args;

if (existsSync(winVenv)) {
  command = winVenv;
  args = ["-m", "pytest", "-q"];
} else if (existsSync(unixVenv)) {
  command = unixVenv;
  args = ["-m", "pytest", "-q"];
} else if (process.platform === "win32") {
  command = "py";
  args = ["-3", "-m", "pytest", "-q"];
} else {
  command = "python3";
  args = ["-m", "pytest", "-q"];
}

const r = spawnSync(command, args, {
  cwd: apiDir,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
