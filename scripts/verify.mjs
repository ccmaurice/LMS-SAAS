/**
 * Plan-Act-Verify gate: lint + production build + optional HTTP smoke tests.
 * Usage: npm run verify
 * Optional: VERIFY_BASE_URL=http://localhost:3000 (dev server must be running)
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env, shell: true });
}

async function smoke(base) {
  const health = await fetch(`${base}/api/health`);
  if (!health.ok) throw new Error(`health ${health.status}`);
  const j = await health.json();
  if (!j || typeof j !== "object" || j.ok !== true) throw new Error("health body");

  const ready = await fetch(`${base}/api/health/ready`);
  if (!ready.ok) {
    const body = await ready.text();
    throw new Error(`health/ready ${ready.status} ${body.slice(0, 200)}`);
  }
  const rj = await ready.json();
  if (!rj || typeof rj !== "object" || rj.ok !== true) throw new Error("health/ready body");

  const cms = await fetch(`${base}/api/admin/cms`);
  if (cms.status !== 401) throw new Error(`cms unauthenticated expected 401, got ${cms.status}`);
}

async function main() {
  run("npm run lint");
  run("npm test");
  run("npm run build");

  const raw = process.env.VERIFY_BASE_URL?.trim();
  if (raw) {
    const base = raw.replace(/\/$/, "");
    await smoke(base);
  }

  process.exit(0);
}

main().catch(() => process.exit(1));
