// Compares memory reports (tests/browser-memory) of two sets of runs, phase by phase.
//
//   node e2e/scripts/memory-compare.mjs <before-label>[,<label>...] <after-label>[,<label>...]
//
// Labels name `.debug/e2e/memory/<label>/report.json`. Several labels per side are
// reduced to their median, since process footprints vary from run to run.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MEMORY_DIR = resolve(import.meta.dirname, "../../.debug/e2e/memory");
const MB = 1024 * 1024;

const [beforeArg, afterArg] = process.argv.slice(2);
if (beforeArg == null || afterArg == null) {
  console.error("usage: memory-compare.mjs <before-labels> <after-labels>");
  process.exit(1);
}

const load = (label) => JSON.parse(readFileSync(resolve(MEMORY_DIR, label, "report.json"), "utf8"));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Metric name -> value for one phase of one run. Names ending in "(MB)" hold bytes. */
function metrics(phase) {
  const out = { "extension process footprint (MB)": 0 };
  for (const p of phase.processes) {
    out["extension process footprint (MB)"] += p.footprint;
  }

  // Pages are told apart by URL: with content scripts, or the excluded baseline.
  for (const t of phase.targets) {
    const kind =
      t.kind === "page" ? (t.url.includes("baseline.xml") ? "page_no_ext" : "page_ext") : t.kind;
    out[`${kind} JS heap (MB)`] = (out[`${kind} JS heap (MB)`] ?? 0) + t.heap.used;
    out[`${kind} wasm (MB)`] = (out[`${kind} wasm (MB)`] ?? 0) + t.heap.wasm;
    if (t.kind === "page") {
      out[`${kind} buffers (MB)`] = (out[`${kind} buffers (MB)`] ?? 0) + t.heap.backingStorage;
    }
  }

  const findings = phase.findings;
  if (findings != null) {
    out["SW decrypt calls"] = findings.decryptCalls.calls;
    out["SW ciphers decrypted"] = findings.decryptCalls.items;
    out["SW max concurrent decrypts"] = findings.decryptCalls.maxConcurrent;
    out["decrypted cache in session storage (MB)"] =
      findings.decryptedCipherCache.sessionStorageBytes;
    out["decrypted ciphers cached in memory"] = findings.decryptedCipherCache.inMemoryCiphers;
    out["plaintext passwords in SW heap"] = findings.plaintextPasswordsInHeap;
  }

  return out;
}

/** Phase -> metric -> median across runs. */
function summarize(labels) {
  const runs = labels.split(",").map(load);
  const result = new Map();

  for (const phase of runs[0]) {
    const perRun = runs.map((run) => metrics(run.find((p) => p.name === phase.name)));
    const merged = {};
    for (const key of Object.keys(perRun[0])) {
      const values = perRun.map((m) => m[key]).filter((v) => v != null);
      if (values.length === 0) {
        continue;
      }
      merged[key] = median(values);
    }
    result.set(phase.name, merged);
  }

  return result;
}

const before = summarize(beforeArg);
const after = summarize(afterArg);

const format = (key, value) => (key.endsWith("(MB)") ? (value / MB).toFixed(1) : String(value));
const change = (before, after) => {
  if (before === after) {
    return "=";
  }
  if (before === 0) {
    return "new";
  }
  const percent = ((after - before) / before) * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(0)}%`;
};

console.log("| phase | metric | before | after | change |");
console.log("|---|---|---:|---:|---:|");
for (const [phase, metricsBefore] of before) {
  for (const [key, valueBefore] of Object.entries(metricsBefore)) {
    const valueAfter = after.get(phase)?.[key] ?? 0;
    if (valueBefore === 0 && valueAfter === 0) {
      continue;
    }
    console.log(
      `| ${phase} | ${key} | ${format(key, valueBefore)} | ${format(key, valueAfter)} | ${change(valueBefore, valueAfter)} |`,
    );
  }
}
