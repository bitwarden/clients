#!/usr/bin/env node
// @ts-check
/**
 * Measure the memory usage of the running Electron desktop app and every one of
 * its child processes (renderers, GPU process, utility processes, etc.).
 *
 * Usage:
 *   node apps/desktop/scripts/measure-memory.js            # snapshot the "Bitwarden" app
 *   node apps/desktop/scripts/measure-memory.js --dev      # target the dev "Electron" app
 *   node apps/desktop/scripts/measure-memory.js --name foo # match a custom process name
 *   node apps/desktop/scripts/measure-memory.js --pid 1234 # start from an explicit root pid
 *   node apps/desktop/scripts/measure-memory.js --watch    # refresh every 2s
 *   node apps/desktop/scripts/measure-memory.js --json     # machine-readable output
 *
 * Reports RSS per process. Works on macOS and Linux (uses `ps`).
 */

const { execFileSync } = require("child_process");
const os = require("os");

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagValue = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

const options = {
  dev: hasFlag("--dev"),
  json: hasFlag("--json"),
  watch: hasFlag("--watch"),
  name: flagValue("--name"),
  pid: flagValue("--pid") ? Number(flagValue("--pid")) : undefined,
  intervalMs: Number(flagValue("--interval")) || 2000,
};

// Default matcher: the packaged product is "Bitwarden"; `npm run electron` runs "Electron".
const matchName = options.name ?? (options.dev ? "Electron" : "Bitwarden");

if (os.platform() === "win32") {
  console.error(
    "This script uses `ps` and only supports macOS/Linux. On Windows use Task Manager " +
      "or `Get-Process` grouped by process tree.",
  );
  process.exit(1);
}

/**
 * Snapshot every process: pid, ppid, rss (KB), and full command line.
 * @returns {{ pid: number, ppid: number, rssKb: number, command: string }[]}
 */
function snapshotProcesses() {
  // -e all processes, -o custom columns. `comm=` last would truncate; use `command=`.
  const out = execFileSync("ps", ["-eo", "pid=,ppid=,rss=,command="], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const procs = [];
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const m = trimmed.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) {
      continue;
    }
    procs.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      rssKb: Number(m[3]),
      command: m[4],
    });
  }
  return procs;
}

/**
 * Find the root Electron process: the one whose command matches the app name but
 * is NOT a child of another matching process (i.e. the main/browser process).
 */
function findRoots(procs, self) {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const matches = procs.filter(
    (p) =>
      p.pid !== self &&
      // Match the app binary; the main process has no `--type=` flag.
      p.command.includes(matchName) &&
      !p.command.includes("measure-memory") &&
      !/--type=/.test(p.command),
  );
  // Keep only those whose parent isn't itself a match (the true tree roots).
  const matchPids = new Set(matches.map((p) => p.pid));
  return matches.filter((p) => !matchPids.has(byPid.get(p.ppid)?.pid));
}

/** Collect a pid and all its descendants. */
function collectTree(procs, rootPid) {
  const childrenByPpid = new Map();
  for (const p of procs) {
    if (!childrenByPpid.has(p.ppid)) {
      childrenByPpid.set(p.ppid, []);
    }
    childrenByPpid.get(p.ppid).push(p);
  }
  const result = [];
  const stack = [rootPid];
  const seen = new Set();
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) {
      continue;
    }
    seen.add(pid);
    const proc = procs.find((p) => p.pid === pid);
    if (proc) {
      result.push(proc);
    }
    for (const child of childrenByPpid.get(pid) ?? []) {
      stack.push(child.pid);
    }
  }
  return result;
}

/** Derive a friendly Electron process type from the command line. */
function classify(proc, isRoot) {
  if (isRoot) {
    return "main";
  }
  const typeMatch = proc.command.match(/--type=([\w-]+)/);
  if (!typeMatch) {
    return "helper";
  }
  const type = typeMatch[1];
  if (type === "renderer") {
    // Distinguish the extension/service-worker-ish renderers if a utility sub-type is present.
    return proc.command.includes("--extension-process") ? "renderer(extension)" : "renderer";
  }
  if (type === "utility") {
    const sub = proc.command.match(/--utility-sub-type=([\w.-]+)/);
    return sub ? `utility(${sub[1].split(".").pop()})` : "utility";
  }
  return type; // gpu-process, zygote, broker, etc.
}

function formatMb(kb) {
  return (kb / 1024).toFixed(1);
}

function report() {
  const procs = snapshotProcesses();
  const roots = options.pid
    ? procs.filter((p) => p.pid === options.pid)
    : findRoots(procs, process.pid);

  if (!roots.length) {
    console.error(
      `No running "${matchName}" process found.` +
        (options.dev ? "" : " If running the dev build, pass --dev."),
    );
    return false;
  }

  const rows = [];
  const seen = new Set();
  for (const root of roots) {
    for (const proc of collectTree(procs, root.pid)) {
      if (seen.has(proc.pid)) {
        continue;
      }
      seen.add(proc.pid);
      rows.push({
        pid: proc.pid,
        type: classify(proc, proc.pid === root.pid),
        rssKb: proc.rssKb,
      });
    }
  }

  rows.sort((a, b) => b.rssKb - a.rssKb);
  const totalKb = rows.reduce((sum, r) => sum + r.rssKb, 0);

  // Aggregate per type.
  const byType = new Map();
  for (const r of rows) {
    const cur = byType.get(r.type) ?? { count: 0, rssKb: 0 };
    cur.count += 1;
    cur.rssKb += r.rssKb;
    byType.set(r.type, cur);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          app: matchName,
          totalRssMb: Number(formatMb(totalKb)),
          processCount: rows.length,
          byType: Object.fromEntries(
            [...byType].map(([type, v]) => [
              type,
              { count: v.count, rssMb: Number(formatMb(v.rssKb)) },
            ]),
          ),
          processes: rows.map((r) => ({ pid: r.pid, type: r.type, rssMb: Number(formatMb(r.rssKb)) })),
        },
        null,
        2,
      ),
    );
    return true;
  }

  console.log(`\nMemory usage for "${matchName}" — ${new Date().toLocaleTimeString()}`);
  console.log("─".repeat(48));
  console.log("PID".padEnd(9) + "TYPE".padEnd(24) + "RSS (MB)".padStart(12));
  console.log("─".repeat(48));
  for (const r of rows) {
    console.log(
      String(r.pid).padEnd(9) + r.type.padEnd(24) + formatMb(r.rssKb).padStart(12),
    );
  }
  console.log("─".repeat(48));
  console.log("By type:");
  for (const [type, v] of [...byType].sort((a, b) => b[1].rssKb - a[1].rssKb)) {
    console.log(
      `  ${type.padEnd(22)} ${String(`${v.count}×`).padStart(4)} ${formatMb(v.rssKb).padStart(10)} MB`,
    );
  }
  console.log("─".repeat(48));
  console.log(
    `TOTAL: ${rows.length} processes, ${formatMb(totalKb)} MB RSS`.padStart(48),
  );
  console.log();
  return true;
}

if (options.watch) {
  const tick = () => {
    if (!options.json) {
      process.stdout.write("\x1Bc"); // clear screen
    }
    report();
  };
  tick();
  setInterval(tick, options.intervalMs);
} else {
  process.exit(report() ? 0 : 1);
}
