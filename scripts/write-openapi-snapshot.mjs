/**
 * Обновляет docs/openapi.snapshot.json (Python venv в apps/api или py -3).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = join(root, "apps", "api");
const script = join(apiDir, "scripts", "write_openapi_snapshot.py");
const winVenv = join(apiDir, ".venv", "Scripts", "python.exe");
const unixVenv = join(apiDir, ".venv", "bin", "python");

let command;
let args;

if (existsSync(winVenv)) {
  command = winVenv;
  args = [script];
} else if (existsSync(unixVenv)) {
  command = unixVenv;
  args = [script];
} else if (process.platform === "win32") {
  command = "py";
  args = ["-3", script];
} else {
  command = "python3";
  args = [script];
}

const r = spawnSync(command, args, {
  cwd: root,
  stdio: "inherit",
  shell: false,
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
