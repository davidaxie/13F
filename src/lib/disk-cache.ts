import fs from "node:fs/promises";
import path from "node:path";

// Vercel serverless filesystem is read-only except for /tmp (which is also
// per-container, not persistent across cold starts). Locally we cache into
// .cache/ in the project root.
const ROOT = process.env.VERCEL
  ? "/tmp/13f-cache"
  : path.join(process.cwd(), ".cache");

export async function readJson<T>(rel: string): Promise<T | null> {
  try {
    const buf = await fs.readFile(path.join(ROOT, rel), "utf-8");
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

export async function writeJson(rel: string, data: unknown): Promise<void> {
  const full = path.join(ROOT, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  // Write atomically: tmp + rename to avoid corruption on concurrent writes.
  const tmp = full + "." + process.pid + "." + Date.now() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, full);
}
