import { execFileSync } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CdpSession, Target, listTargets } from "./cdp";

const PURGE_SETTLE_MS = 2_000;

const EXTENSION_SCHEME = "chrome-extension://";
// Two passes: the first collection runs finalizers that free more on the second.
const GC_PASSES = 2;

/** Heap of one V8 isolate, in bytes, read after a forced garbage collection. */
export type HeapUsage = {
  /** Live JS objects. */
  used: number;
  /** Heap V8 reserved, live or not. */
  total: number;
  /** Blink's C++ heap (DOM nodes, etc.). */
  embedder: number;
  /** ArrayBuffer backing stores, excluding WebAssembly memory. */
  backingStorage: number;
  /** Linear memory of every WebAssembly instance, i.e. the SDK. Never shrinks. */
  wasm: number;
};

export type TargetMemory = { kind: string; url: string; heap: HeapUsage };

type RawHeapUsage = {
  usedSize: number;
  totalSize: number;
  embedderHeapUsedSize: number;
  backingStorageSize: number;
};

/**
 * Signals critical memory pressure to every renderer, as the OS would. Chromium then
 * returns cached allocator memory and runs full GCs, so what remains is what is in use.
 */
export async function purgeMemory(port: number) {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`);
  const { webSocketDebuggerUrl } = (await response.json()) as { webSocketDebuggerUrl: string };
  const browser = await CdpSession.connect({ webSocketDebuggerUrl } as Target);

  try {
    await browser.send("Memory.simulatePressureNotification", { level: "critical" });
  } finally {
    browser.close();
  }

  await new Promise((r) => setTimeout(r, PURGE_SETTLE_MS));
}

/** Every extension target, plus the web pages whose URL matches `pages`. */
export async function findTargets(port: number, pages?: RegExp): Promise<Target[]> {
  const targets = await listTargets(port);

  return targets.filter(
    (t) => t.url.startsWith(EXTENSION_SCHEME) || (pages != null && pages.test(t.url)),
  );
}

/** Kind of an extension context, e.g. `service_worker`, `popup`, `offscreen`. */
export function kindOf(target: Target): string {
  if (!target.url.startsWith(EXTENSION_SCHEME)) {
    return "page";
  }

  if (target.type === "service_worker") {
    return "service_worker";
  }

  const path = new URL(target.url).pathname;
  if (path.includes("popup")) {
    return "popup";
  }
  if (path.includes("offscreen")) {
    return "offscreen";
  }

  return path.includes("overlay") ? "inline_menu" : target.type;
}

/** Collects garbage, then reads the target's heap. Optionally saves a heap snapshot. */
export async function measure(target: Target, snapshotPath?: string): Promise<TargetMemory> {
  const session = await CdpSession.connect(target);

  try {
    for (let i = 0; i < GC_PASSES; i++) {
      await session.send("HeapProfiler.collectGarbage");
    }

    const raw = await session.send<RawHeapUsage>("Runtime.getHeapUsage");
    const wasm = await wasmMemory(session);

    if (snapshotPath != null) {
      await takeSnapshot(session, snapshotPath);
    }

    return {
      kind: kindOf(target),
      url: target.url,
      heap: {
        used: raw.usedSize,
        total: raw.totalSize,
        embedder: raw.embedderHeapUsedSize,
        backingStorage: raw.backingStorageSize,
        wasm,
      },
    };
  } finally {
    session.close();
  }
}

/**
 * Sums the size of every live `WebAssembly.Memory`. The SDK keeps its instance in
 * module scope, out of reach of an expression, but the heap can be queried by prototype.
 */
async function wasmMemory(session: CdpSession): Promise<number> {
  const prototype = await session.send("Runtime.evaluate", {
    expression: "WebAssembly.Memory.prototype",
  });
  const { objects } = await session.send("Runtime.queryObjects", {
    prototypeObjectId: prototype.result.objectId,
  });
  const { result } = await session.send("Runtime.callFunctionOn", {
    objectId: objects.objectId,
    functionDeclaration:
      "function () { return this.reduce((s, m) => s + m.buffer.byteLength, 0); }",
    returnByValue: true,
  });

  return result.value;
}

const SETTLE_INTERVAL_MS = 2_000;
const SETTLE_TOLERANCE = 0.02;
const SETTLE_STABLE_READS = 3;
const SETTLE_TIMEOUT_MS = 120_000;

/**
 * Waits until the target's heap stops moving: background work such as a sync and the
 * decryption that follows has no event to wait on. Stable means 3 reads in a row,
 * 2s apart, each within 2% of the one before.
 */
export async function waitForStableHeap(target: Target) {
  const session = await CdpSession.connect(target);
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  let previous = 0;
  let stable = 0;

  try {
    while (stable < SETTLE_STABLE_READS && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, SETTLE_INTERVAL_MS));
      // Garbage alone would keep the reading moving.
      await session.send("HeapProfiler.collectGarbage");
      const { usedSize } = await session.send<RawHeapUsage>("Runtime.getHeapUsage");

      const drift = Math.abs(usedSize - previous) / Math.max(usedSize, 1);
      stable = drift < SETTLE_TOLERANCE ? stable + 1 : 0;
      previous = usedSize;
    }
  } finally {
    session.close();
  }
}

// An EncString's serialized form, e.g. `2.iv|data|mac`.
const ENC_STRING = /^\d+\.[^|]*\|/;
const SECRET_PROPERTY = "password";

/**
 * Counts the plaintext passwords in the target's heap: objects whose `password` property
 * is a string that is not an EncString. A decrypted vault adds one per login.
 */
export async function countDecryptedPasswords(target: Target): Promise<number> {
  const session = await CdpSession.connect(target);
  const chunks: string[] = [];
  session.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => chunks.push(chunk));

  try {
    await session.send("HeapProfiler.collectGarbage");
    await session.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  } finally {
    session.close();
  }

  const { snapshot: meta, nodes, edges, strings } = JSON.parse(chunks.join(""));
  const nodeFields: string[] = meta.meta.node_fields;
  const edgeFields: string[] = meta.meta.edge_fields;
  const nodeTypes: string[] = meta.meta.node_types[0];
  const edgeTypes: string[] = meta.meta.edge_types[0];
  const nodeStride = nodeFields.length;
  const edgeStride = edgeFields.length;
  const secretName = strings.indexOf(SECRET_PROPERTY);
  if (secretName < 0) {
    return 0;
  }

  // Edges are stored per node, in node order, `edge_count` at a time.
  let count = 0;
  let edge = 0;
  for (let node = 0; node < nodes.length; node += nodeStride) {
    const edgeCount = nodes[node + nodeFields.indexOf("edge_count")];

    for (let e = 0; e < edgeCount; e++, edge += edgeStride) {
      const type = edgeTypes[edges[edge + edgeFields.indexOf("type")]];
      if (type !== "property" || edges[edge + edgeFields.indexOf("name_or_index")] !== secretName) {
        continue;
      }

      const to = edges[edge + edgeFields.indexOf("to_node")];
      const toType = nodeTypes[nodes[to + nodeFields.indexOf("type")]];
      const value: string = strings[nodes[to + nodeFields.indexOf("name")]];
      if (toType === "string" && value.length > 0 && !ENC_STRING.test(value)) {
        count++;
      }
    }
  }

  return count;
}

/** Streams a `.heapsnapshot` to disk; open it in DevTools' Memory panel or heap-summary.mjs. */
async function takeSnapshot(session: CdpSession, path: string) {
  const file = createWriteStream(path);
  session.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => file.write(chunk));

  await session.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
  await new Promise<void>((resolve) => file.end(resolve));
}

/** One OS process, with its physical footprint as Activity Monitor reports it. */
export type ProcessMemory = {
  pid: number;
  footprint: number;
  /** Footprint by VM region kind, largest first, e.g. `WebAssembly memory`, `MALLOC_SMALL`. */
  regions: Record<string, number>;
};

const TOP_REGIONS = 8;

type FootprintCategory = { dirty: number; swapped: number };
type FootprintJson = {
  processes: { pid: number; footprint: number; categories: Record<string, FootprintCategory> }[];
};

/** Chromium's renderer processes hosting extension contexts. */
export function extensionPids(): number[] {
  const ps = execFileSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" });

  return ps
    .split("\n")
    .filter((line) => line.includes("--extension-process") && line.includes("ms-playwright"))
    .map((line) => Number.parseInt(line.trim(), 10));
}

/**
 * Physical footprint of the extension's processes (macOS `footprint`). The service
 * worker, popup, offscreen document and inline menu frames live there, outside of the
 * pages the content scripts run in. Covers what JS heap readings miss: WebAssembly
 * memory, code, Blink and malloc.
 */
export function extensionProcesses(): ProcessMemory[] {
  const pids = extensionPids();
  if (pids.length === 0) {
    return [];
  }

  const file = join(tmpdir(), `footprint-${process.pid}.json`);
  const args = pids.flatMap((pid) => ["-p", String(pid)]);
  execFileSync("footprint", [...args, "-f", "bytes", "-j", file], { stdio: "ignore" });
  const json = JSON.parse(readFileSync(file, "utf8")) as FootprintJson;

  return json.processes.map((p) => {
    const regions = Object.entries(p.categories)
      .map(([name, c]) => [name, c.dirty + c.swapped] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_REGIONS);

    return { pid: p.pid, footprint: p.footprint, regions: Object.fromEntries(regions) };
  });
}
