import { spawn } from "node:child_process";

// Each check owns a process group so npm's shell and its descendants share the
// deadline. Killing npm alone can leave the actual check running indefinitely.
export function runCommand(
  command,
  args,
  { cwd, timeoutMs = 5 * 60 * 1000, graceMs = 2000, stdio = "inherit" } = {},
) {
  if (process.platform === "win32") {
    throw new Error(
      "Verification requires a Unix environment (Linux or macOS).",
    );
  }
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      stdio,
      shell: false,
      detached: true,
    });
    let closed = false;
    let escalated = false;
    let timedOut = false;
    let stopping = false;
    let interrupted;
    let error;
    let status = null;
    let signal = null;
    let escalation;
    const finish = () => {
      if (!closed || (stopping && !escalated)) return;
      clearTimeout(deadline);
      clearTimeout(escalation);
      for (const [name, handler] of handlers)
        process.removeListener(name, handler);
      resolve({
        status: interrupted ? null : status,
        signal: signal ?? interrupted,
        error,
        timedOut,
      });
    };
    const signalGroup = (name) => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, name);
      } catch (failure) {
        if (failure.code !== "ESRCH") error ??= failure;
      }
    };
    const stop = () => {
      if (stopping) return;
      stopping = true;
      clearTimeout(deadline);
      signalGroup("SIGTERM");
      escalation = setTimeout(() => {
        // Keep this escalation even if npm exits after TERM: its descendants
        // may still be running in the group without their original leader.
        signalGroup("SIGKILL");
        escalated = true;
        finish();
      }, graceMs);
    };
    const deadline = setTimeout(() => {
      timedOut = true;
      error = Object.assign(
        new Error(`Check exceeded ${timeoutMs}ms deadline.`),
        {
          code: "ETIMEDOUT",
        },
      );
      stop();
    }, timeoutMs);
    // The group is detached from the terminal, so forward owner interruptions
    // and finish cleanup before allowing the verifier to exit.
    const handlers = ["SIGINT", "SIGTERM", "SIGHUP"].map((name) => {
      const handler = () => {
        interrupted ??= name;
        stop();
      };
      process.on(name, handler);
      return [name, handler];
    });
    child.once("error", (failure) => {
      error = failure;
    });
    child.once("close", (code, terminationSignal) => {
      status = code;
      signal = terminationSignal;
      closed = true;
      finish();
    });
  });
}
