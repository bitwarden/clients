import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { E2E_STATE_DIR } from "../../paths";

import { Target } from "./cdp";
import {
  ProcessMemory,
  TargetMemory,
  extensionProcesses,
  kindOf,
  measure,
  purgeMemory,
} from "./probe";

const MEMORY_DIR = resolve(E2E_STATE_DIR, "memory");
const MB = 1024 * 1024;

/** Names a run, e.g. `baseline` or `fix-lazy-sdk`; its results land in `memory/<label>/`. */
const LABEL = process.env.E2E_MEMORY_LABEL ?? "run";
/** Signals memory pressure before each reading, e.g. `E2E_MEMORY_PRESSURE=1`. */
const PRESSURE = process.env.E2E_MEMORY_PRESSURE != null;
/** Saves a heap snapshot of every target measured, e.g. `E2E_HEAP_SNAPSHOT=1`. */
const SNAPSHOTS = process.env.E2E_HEAP_SNAPSHOT != null;

/** What a phase found beyond memory readings, e.g. decrypt calls or cache state. */
type Findings = Record<string, unknown>;

type Phase = {
  name: string;
  processes: ProcessMemory[];
  targets: TargetMemory[];
  findings?: Findings;
};

/** Measures the extension phase by phase and writes `memory/<label>/report.json`. */
export class MemoryReport {
  private phases: Phase[] = [];
  private dir = join(MEMORY_DIR, LABEL);

  constructor(private port: number) {
    mkdirSync(this.dir, { recursive: true });
  }

  async record(name: string, targets: Target[], findings?: Findings): Promise<Phase> {
    const measured: TargetMemory[] = [];
    if (PRESSURE) {
      await purgeMemory(this.port);
    }

    for (const [index, target] of targets.entries()) {
      const snapshot = SNAPSHOTS
        ? join(this.dir, `${name}-${kindOf(target)}-${index}.heapsnapshot`)
        : undefined;
      measured.push(await measure(target, snapshot));
    }

    const phase = { name, processes: extensionProcesses(), targets: measured, findings };
    this.phases.push(phase);
    this.print(phase);

    return phase;
  }

  write() {
    writeFileSync(join(this.dir, "report.json"), JSON.stringify(this.phases, null, 2));
  }

  private print(phase: Phase) {
    const mb = (bytes: number) => (bytes / MB).toFixed(1).padStart(7);
    const rows = phase.targets.map(
      (t) =>
        `  ${t.kind.padEnd(15)} used${mb(t.heap.used)}  embedder${mb(t.heap.embedder)}  ` +
        `buffers${mb(t.heap.backingStorage)}  wasm${mb(t.heap.wasm)}  ${t.url.slice(0, 60)}`,
    );

    const processes = phase.processes.map(
      (p) =>
        `  process ${p.pid} footprint${mb(p.footprint)}  ` +
        Object.entries(p.regions)
          .map(([region, bytes]) => `${region}:${(bytes / MB).toFixed(1)}`)
          .join(" "),
    );

    const findings = phase.findings ? [`  findings ${JSON.stringify(phase.findings)}`] : [];

    // eslint-disable-next-line no-console
    console.log(`[${LABEL}] ${phase.name}\n${[...rows, ...processes, ...findings].join("\n")}`);
  }
}
