// Summarizes a V8 .heapsnapshot: self size and count per constructor, largest first.
//
//   node e2e/scripts/heap-summary.mjs <file.heapsnapshot> [top=30]
//
// Self size only: what an object holds directly, not what it keeps alive. Enough to see
// which kinds of object dominate a heap; DevTools' Memory panel has retained sizes.

import { readFileSync } from "node:fs";

const MB = 1024 * 1024;
const DEFAULT_TOP = 30;

const [file, topArg] = process.argv.slice(2);
if (file == null) {
  console.error("usage: heap-summary.mjs <file.heapsnapshot> [top]");
  process.exit(1);
}

const snapshot = JSON.parse(readFileSync(file, "utf8"));
const { node_fields: fields, node_types: types } = snapshot.snapshot.meta;
const stride = fields.length;
const typeIndex = fields.indexOf("type");
const nameIndex = fields.indexOf("name");
const sizeIndex = fields.indexOf("self_size");
const typeNames = types[0];

// Group by constructor for objects, by node type for everything else (strings, code...).
const groups = new Map();
let total = 0;

for (let i = 0; i < snapshot.nodes.length; i += stride) {
  const type = typeNames[snapshot.nodes[i + typeIndex]];
  const size = snapshot.nodes[i + sizeIndex];
  const key = type === "object" ? snapshot.strings[snapshot.nodes[i + nameIndex]] : `(${type})`;

  const group = groups.get(key) ?? { count: 0, size: 0 };
  group.count++;
  group.size += size;
  groups.set(key, group);
  total += size;
}

const top = Number(topArg ?? DEFAULT_TOP);
console.log(`total self size ${(total / MB).toFixed(1)} MB`);

for (const [key, { count, size }] of [...groups]
  .sort((a, b) => b[1].size - a[1].size)
  .slice(0, top)) {
  console.log(
    `${(size / MB).toFixed(2).padStart(8)} MB ${String(count).padStart(9)}  ${key.slice(0, 80)}`,
  );
}
