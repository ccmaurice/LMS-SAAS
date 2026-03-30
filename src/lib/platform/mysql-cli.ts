import { spawn } from "node:child_process";

const MAX_DUMP_BYTES = 250 * 1024 * 1024;

function isMysqlUrl(url: string | undefined): boolean {
  return !!url?.trim().startsWith("mysql:");
}

/** mysqldump/mysql CLI only; disabled when using PostgreSQL (e.g. Supabase). */
export function platformDatabaseToolsEnabled(): boolean {
  const v = process.env.ENABLE_PLATFORM_DATABASE_TOOLS?.trim().toLowerCase();
  if (!(v === "true" || v === "1" || v === "yes")) return false;
  return isMysqlUrl(process.env.DATABASE_URL);
}

function parseMysqlDatabaseUrl(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const normalized = url.trim().replace(/^mysql:\/\//, "http://");
  const u = new URL(normalized);
  const database = u.pathname.replace(/^\//, "").split("?")[0];
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }
  return {
    host: u.hostname === "localhost" ? "127.0.0.1" : u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username || ""),
    password: decodeURIComponent(u.password || ""),
    database,
  };
}

function getMysqlUrl(): string | null {
  const u = process.env.DATABASE_URL?.trim();
  return u && u.startsWith("mysql:") ? u : null;
}

export async function runMysqldumpPlain(): Promise<{ ok: true; sql: string } | { ok: false; error: string }> {
  const url = getMysqlUrl();
  if (!url) {
    return { ok: false, error: "DATABASE_URL must be a mysql:// connection string for mysqldump." };
  }
  const c = parseMysqlDatabaseUrl(url);

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let stderr = "";
    const args = [
      `--host=${c.host}`,
      `--port=${String(c.port)}`,
      `--user=${c.user}`,
      `--password=${c.password}`,
      "--single-transaction",
      "--routines=false",
      "--triggers=false",
      "--set-gtid-purged=OFF",
      c.database,
    ];
    const child = spawn("mysqldump", args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (buf: Buffer) => {
      chunks.push(buf);
      const total = chunks.reduce((s, b) => s + b.length, 0);
      if (total > MAX_DUMP_BYTES) {
        child.kill("SIGKILL");
      }
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve({
          ok: false,
          error:
            "mysqldump was not found. Install MySQL client tools and add mysqldump to your PATH, or run backups from your host.",
        });
        return;
      }
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code !== 0 && code !== null) {
        resolve({
          ok: false,
          error: stderr.trim() || `mysqldump exited with code ${code}`,
        });
        return;
      }
      const buf = Buffer.concat(chunks);
      if (buf.length >= MAX_DUMP_BYTES) {
        resolve({ ok: false, error: "Dump exceeded size limit (250 MB). Use host mysqldump for large databases." });
        return;
      }
      resolve({ ok: true, sql: buf.toString("utf8") });
    });
  });
}

export async function runMysqlRestore(sql: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = getMysqlUrl();
  if (!url) {
    return { ok: false, error: "DATABASE_URL must be a mysql:// connection string for restore." };
  }
  const c = parseMysqlDatabaseUrl(url);

  return new Promise((resolve) => {
    let stderr = "";
    const args = [`--host=${c.host}`, `--port=${String(c.port)}`, `--user=${c.user}`, `--password=${c.password}`, c.database];
    const child = spawn("mysql", args, {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.stdin?.write(sql, "utf8");
    child.stdin?.end();
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve({
          ok: false,
          error: "mysql client was not found. Install MySQL client tools and add mysql to your PATH.",
        });
        return;
      }
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code !== 0) {
        resolve({
          ok: false,
          error: stderr.trim() || `mysql exited with code ${code}`,
        });
        return;
      }
      resolve({ ok: true });
    });
  });
}
