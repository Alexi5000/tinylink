import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCommand } from "./verify-command.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../outputs/", import.meta.url);
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
};
const report = {
  revision: git("rev-parse", "HEAD"),
  workingTreeDirty: git("status", "--porcelain") !== "",
  startedAt: new Date().toISOString(),
  node: process.version,
  status: "running",
  checks: [],
};
mkdirSync(output, { recursive: true });
function saveReport() {
  const temporary = new URL("verification.json.tmp", output);
  writeFileSync(temporary, JSON.stringify(report, null, 2) + "\n");
  renameSync(temporary, new URL("verification.json", output));
}

saveReport();
for (const script of ["format:check", "lint", "test", "typecheck", "build"]) {
  const started = Date.now();
  console.log(`\nRunning npm run ${script}`);
  const result = await runCommand("npm", ["run", script], { cwd: root });
  const exitCode = result.timedOut ? 1 : (result.status ?? 1);
  report.checks.push({
    command: ["npm", "run", script],
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    exitCode,
    status: exitCode === 0 ? "passed" : "failed",
    ...(result.timedOut ? { timedOut: true } : {}),
    ...(result.signal ? { signal: result.signal } : {}),
    ...(result.error ? { error: result.error.message } : {}),
  });
  if (exitCode !== 0) {
    report.status = "failed";
    report.finishedAt = new Date().toISOString();
    saveReport();
    process.exit(exitCode);
  }
  saveReport();
}
report.status = "passed";
report.finishedAt = new Date().toISOString();
saveReport();
console.log("\nVerification passed. Evidence: outputs/verification.json");
