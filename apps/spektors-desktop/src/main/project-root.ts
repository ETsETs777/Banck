import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";

/** Те же критерии, что и в IPC `project:validate`. */
export async function isSpektorsMonorepoRoot(dir: string): Promise<boolean> {
  const r = path.resolve(dir);
  const pkg = path.join(r, "package.json");
  const dc = path.join(r, "docker-compose.yml");
  const api = path.join(r, "apps", "api");
  try {
    await access(pkg, fsConstants.R_OK);
    await access(dc, fsConstants.R_OK);
    await access(api, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function walkUpDirs(start: string, maxDepth: number): string[] {
  const out: string[] = [];
  let cur = path.resolve(start);
  for (let i = 0; i < maxDepth; i++) {
    out.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return out;
}

/**
 * Ищет корень монорепо, поднимаясь вверх от нескольких стартовых точек
 * (cwd, каталог приложения, родители `out/main` при dev-сборке и т.д.).
 */
export async function detectSpektorsProjectRoot(seeds: string[]): Promise<string | null> {
  const tried = new Set<string>();
  for (const raw of seeds) {
    let seed: string;
    try {
      seed = path.resolve(raw);
    } catch {
      continue;
    }
    for (const dir of walkUpDirs(seed, 14)) {
      if (tried.has(dir)) continue;
      tried.add(dir);
      if (await isSpektorsMonorepoRoot(dir)) return dir;
    }
  }
  return null;
}

export function collectRootDetectionSeeds(
  opts: {
    cwd: string;
    mainDirname: string;
    exeDir: string;
  },
): string[] {
  const { cwd, mainDirname, exeDir } = opts;
  const out: string[] = [];
  const push = (p: string) => {
    if (p) out.push(p);
  };
  push(cwd);
  push(exeDir);
  push(mainDirname);
  push(path.join(mainDirname, ".."));
  push(path.join(mainDirname, "..", ".."));
  push(path.join(mainDirname, "..", "..", ".."));
  push(path.join(mainDirname, "..", "..", "..", ".."));
  return out;
}
