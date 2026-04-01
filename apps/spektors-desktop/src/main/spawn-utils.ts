import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

export function spawnCmd(
  command: string,
  args: string[],
  cwd: string,
): ChildProcess {
  const cwdResolved = path.resolve(cwd);
  if (process.platform === "win32") {
    const quote = (s: string) =>
      /\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
    const line = [command, ...args].map(quote).join(" ");
    return spawn(line, {
      shell: true,
      cwd: cwdResolved,
      env: { ...process.env },
    });
  }
  return spawn(command, args, {
    shell: false,
    cwd: cwdResolved,
    env: { ...process.env },
  });
}
