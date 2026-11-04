import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { runCommand } from "../scripts/verify-command.mjs";

const unixOnly = { skip: process.platform === "win32", timeout: 8000 };

async function isRunning(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      // A killed descendant can briefly await reaping by the system's init.
      const state = await readFile(`/proc/${pid}/stat`, "utf8");
      return state.slice(state.lastIndexOf(")") + 2).split(" ")[0] !== "Z";
    }
    return true;
  } catch (error) {
    if (["ESRCH", "ENOENT"].includes(error.code)) return false;
    throw error;
  }
}

test(
  "verification supervisor preserves normal command results",
  unixOnly,
  async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "process.exit(7)"],
      {
        timeoutMs: 1500,
        stdio: "ignore",
      },
    );
    assert.equal(result.status, 7);
    assert.equal(result.timedOut, false);
    assert.equal(result.error, undefined);
  },
);

test("verification supervisor reports spawn failures", unixOnly, async () => {
  const result = await runCommand(
    "/nonexistent/tinylink-verification-command",
    [],
    {
      timeoutMs: 1500,
      stdio: "ignore",
    },
  );
  assert.equal(result.error.code, "ENOENT");
  assert.equal(result.timedOut, false);
});

for (const leaderExits of [false, true]) {
  test(
    `verification timeout kills TERM-ignoring descendants when leader ${leaderExits ? "exits" : "ignores TERM"}`,
    unixOnly,
    async (t) => {
      const directory = await mkdtemp(path.join(tmpdir(), "tinylink-verify-"));
      const descendantFile = path.join(directory, "descendant.pid");
      const leaderFile = path.join(directory, "leader.pid");
      t.after(async () => {
        for (const file of [descendantFile, leaderFile]) {
          try {
            const pid = Number(await readFile(file, "utf8"));
            if (await isRunning(pid)) process.kill(pid, "SIGKILL");
          } catch (error) {
            if (!["ESRCH", "ENOENT"].includes(error.code)) throw error;
          }
        }
        await rm(directory, { recursive: true, force: true });
      });
      const descendant = `
        const fs = require('node:fs');
        process.on('SIGTERM', () => {});
        fs.writeFileSync(process.argv[1], String(process.pid));
        setInterval(() => {}, 1000);
      `;
      const leader = `
        const fs = require('node:fs');
        const { spawn } = require('node:child_process');
        process.on('SIGTERM', () => { ${leaderExits ? "process.exit(0);" : ""} });
        fs.writeFileSync(process.argv[2], String(process.pid));
        spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}, process.argv[1]], { stdio: 'ignore' });
        setInterval(() => {}, 1000);
      `;
      const result = await runCommand(
        process.execPath,
        ["-e", leader, descendantFile, leaderFile],
        { timeoutMs: 1500, graceMs: 150, stdio: "ignore" },
      );
      assert.equal(result.timedOut, true);
      assert.equal(result.error.code, "ETIMEDOUT");
      if (leaderExits) assert.equal(result.status, 0);
      else assert.equal(result.signal, "SIGKILL");
      const descendantPid = Number(await readFile(descendantFile, "utf8"));
      for (let attempt = 0; attempt < 50; attempt++) {
        if (!(await isRunning(descendantPid))) break;
        await delay(20);
      }
      assert.equal(await isRunning(descendantPid), false);
    },
  );
}
