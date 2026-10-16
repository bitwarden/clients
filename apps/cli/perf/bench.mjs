// End-to-end CLI performance harness: times the prod build of `bw` as a user runs it.
//
//   variant worktree ──► apps/cli/build/bw.js (npm run build:oss:prod)
//          │
//          ├─ setup (untimed): own data dir, config server, login, session key
//          │
//          └─ per command: 1 warmup + PERF_RUNS runs, interleaved across variants per round
//                 spawn ──► first stdout byte ──► stdout EOF ──► process exit
//
// Each run records time to first output byte (`output`) and time to process exit (`exit`). A run
// whose output fails the command's check aborts the harness: a failing command is never measured.
//
// Env:
//   PERF_SERVER     server URL                                   (required)
//   PERF_EMAIL      account email                                (required)
//   PERF_PASSWORD   account master password                      (required)
//   PERF_VARIANTS   comma-separated label=worktree pairs         (required)
//   PERF_COMMANDS   comma-separated command names, see COMMANDS  (default get-item)
//   PERF_ROUNDS     interleaved rounds                           (default 3)
//   PERF_RUNS       timed runs per command per round             (default 5)
//   PERF_DATA       data root; one dir per variant               (default /tmp/bw-perf/data)
//   PERF_OUT        results JSON                                 (default /tmp/bw-perf/results.json)
//
// Example:
//   PERF_SERVER=https://vault.example.com PERF_EMAIL=… PERF_PASSWORD=… \
//   PERF_VARIANTS=base=../clients,fix=../clients-fix node apps/cli/perf/bench.mjs

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const SERVER = required("PERF_SERVER");
const EMAIL = required("PERF_EMAIL");
const PASSWORD = required("PERF_PASSWORD");
const VARIANTS = required("PERF_VARIANTS")
  .split(",")
  .map((pair) => {
    const [label, dir] = pair.split("=");
    return { label, bw: join(dir, "apps/cli/build/bw.js") };
  });
const COMMAND_NAMES = (process.env.PERF_COMMANDS ?? "get-item").split(",");
const ROUNDS = Number(process.env.PERF_ROUNDS ?? 3);
const RUNS = Number(process.env.PERF_RUNS ?? 5);
const WARMUP_RUNS = 1;
const DATA = process.env.PERF_DATA ?? "/tmp/bw-perf/data";
const OUT = process.env.PERF_OUT ?? "/tmp/bw-perf/results.json";

// A command never takes this long; a run that does is reported as hung rather than measured.
const RUN_TIMEOUT_MS = 120_000;

/** Commands under test. `args` gets the probe item picked during setup. */
const COMMANDS = {
  "get-item": {
    args: (item) => ["get", "item", item.id],
    check: (out, item) => JSON.parse(out).id === item.id,
  },
  "get-password": {
    args: (item) => ["get", "password", item.id],
    check: (out, item) => out === item.login.password,
  },
  "list-items": {
    args: () => ["list", "items"],
    check: (out, _item, vault) => JSON.parse(out).length === vault.length,
  },
  status: {
    args: () => ["status"],
    check: (out) => JSON.parse(out).status === "unlocked",
  },
};

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/** Runs `bw` once; resolves with timings and stdout. */
function run(variant, args, env = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let output = null;
    let eof = null;
    const chunks = [];

    const child = spawn(process.execPath, [variant.bw, ...args], {
      env: { ...process.env, ...variant.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${variant.label} ${args.join(" ")} hung for ${RUN_TIMEOUT_MS} ms`));
    }, RUN_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      output ??= performance.now() - start;
      chunks.push(chunk);
    });
    child.stdout.on("end", () => (eof = performance.now() - start));
    child.on("exit", (code) => {
      clearTimeout(timer);
      const exit = performance.now() - start;
      resolve({
        code,
        output: output ?? eof ?? exit,
        exit,
        stdout: Buffer.concat(chunks).toString(),
      });
    });
  });
}

/** Logs the variant into its own data dir and unlocks it; returns the session key. */
async function setup(variant) {
  const dir = join(DATA, variant.label);
  mkdirSync(dir, { recursive: true });
  variant.env = { BITWARDENCLI_APPDATA_DIR: dir, BW_NOINTERACTION: "true" };

  // A data dir left over from an earlier run may still be logged in; start clean.
  await run(variant, ["logout"]);
  await run(variant, ["config", "server", SERVER]);

  const login = await run(variant, ["login", EMAIL, "--passwordenv", "PERF_PASSWORD", "--raw"]);
  if (login.code !== 0 || login.stdout.length === 0) {
    throw new Error(`${variant.label}: login failed`);
  }
  variant.env.BW_SESSION = login.stdout.trim();
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function main() {
  for (const variant of VARIANTS) {
    await setup(variant);
  }

  // The probe item and the expected vault come from the first variant, before anything is timed.
  const listed = await run(VARIANTS[0], ["list", "items"]);
  const vault = JSON.parse(listed.stdout);
  const item = vault[Math.floor(vault.length / 2)];

  const results = {};
  for (let round = 1; round <= ROUNDS; round++) {
    for (const name of COMMAND_NAMES) {
      const command = COMMANDS[name];
      for (const variant of VARIANTS) {
        const timings = [];
        for (let i = 0; i < WARMUP_RUNS + RUNS; i++) {
          const result = await run(variant, command.args(item));
          if (result.code !== 0 || !command.check(result.stdout.trim(), item, vault)) {
            throw new Error(`${variant.label} ${name}: wrong output (exit ${result.code})`);
          }
          if (i >= WARMUP_RUNS) {
            timings.push({ output: result.output, exit: result.exit });
          }
        }

        // Per round the fastest run, as in the SDK harnesses.
        const entry = ((results[name] ??= {})[variant.label] ??= []);
        entry.push({
          round,
          output: Math.min(...timings.map((t) => t.output)),
          exit: Math.min(...timings.map((t) => t.exit)),
        });
        const last = entry.at(-1);
        console.log(
          `r${round} ${name} ${variant.label}: output ${last.output.toFixed(0)} ms, exit ${last.exit.toFixed(0)} ms`,
        );
      }
    }
  }

  mkdirSync(join(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify(results, null, 2));

  // Median across rounds of the per-round minimum, relative to the first variant.
  for (const [name, byVariant] of Object.entries(results)) {
    const base = byVariant[VARIANTS[0].label];
    const baseExit = median(base.map((r) => r.exit));
    const baseOutput = median(base.map((r) => r.output));
    console.log(`\n${name}`);
    for (const variant of VARIANTS) {
      const rounds = byVariant[variant.label];
      const exit = median(rounds.map((r) => r.exit));
      const output = median(rounds.map((r) => r.output));
      const pct = (value, ref) => `${(((value - ref) / ref) * 100).toFixed(1)}%`;
      console.log(
        `  ${variant.label.padEnd(16)} output ${output.toFixed(0).padStart(6)} ms (${pct(output, baseOutput)})   exit ${exit.toFixed(0).padStart(6)} ms (${pct(exit, baseExit)})`,
      );
    }
  }
}

await main();
