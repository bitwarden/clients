// Lists the objects that keep the most memory alive in a V8 .heapsnapshot.
//
//   node e2e/scripts/heap-retainers.mjs <file.heapsnapshot> [top=25]
//
// Retained size: what would be freed if the object went away, i.e. the self size of
// everything it dominates. Each line shows the path from the GC root that reaches it,
// so a minified class name can be traced to the field holding it.

import { readFileSync } from "node:fs";

const MB = 1024 * 1024;
const DEFAULT_TOP = 25;
// Retainers below this share of the heap are noise.
const MIN_SHARE = 0.005;
const PATH_DEPTH = 8;

const [file, topArg] = process.argv.slice(2);
if (file == null) {
  console.error("usage: heap-retainers.mjs <file.heapsnapshot> [top]");
  process.exit(1);
}

const { snapshot, nodes, edges, strings } = JSON.parse(readFileSync(file, "utf8"));
const nodeFields = snapshot.meta.node_fields;
const edgeFields = snapshot.meta.edge_fields;
const nodeTypes = snapshot.meta.node_types[0];
const edgeTypes = snapshot.meta.edge_types[0];
const ns = nodeFields.length;
const es = edgeFields.length;
const count = nodes.length / ns;

const nType = nodeFields.indexOf("type");
const nName = nodeFields.indexOf("name");
const nSize = nodeFields.indexOf("self_size");
const nEdges = nodeFields.indexOf("edge_count");
const eType = edgeFields.indexOf("type");
const eName = edgeFields.indexOf("name_or_index");
const eTo = edgeFields.indexOf("to_node");

// First edge of each node, since edges are stored per node in node order.
const firstEdge = new Uint32Array(count + 1);
for (let n = 0, e = 0; n < count; n++) {
  firstEdge[n] = e;
  e += nodes[n * ns + nEdges] * es;
  firstEdge[n + 1] = e;
}

const isWeak = (e) => edgeTypes[edges[e + eType]] === "weak";
const edgeLabel = (e) => {
  const type = edgeTypes[edges[e + eType]];
  const name = edges[e + eName];
  return type === "element" || type === "hidden" ? `[${name}]` : strings[name];
};

// Depth-first postorder from the root (node 0), ignoring weak edges.
const order = new Int32Array(count).fill(-1);
const post = [];
const stack = [0];
const cursor = new Uint32Array(count);
order[0] = -2;
while (stack.length > 0) {
  const n = stack[stack.length - 1];
  const end = firstEdge[n + 1];
  let e = firstEdge[n] + cursor[n] * es;
  let pushed = false;
  for (; e < end; e += es) {
    cursor[n]++;
    if (isWeak(e)) {
      continue;
    }
    const to = edges[e + eTo] / ns;
    if (order[to] === -1) {
      order[to] = -2;
      stack.push(to);
      pushed = true;
      break;
    }
  }
  if (!pushed) {
    stack.pop();
    order[n] = post.length;
    post.push(n);
  }
}

// Predecessors, for the iterative dominator algorithm (Cooper, Harvey, Kennedy).
const preds = Array.from({ length: count }, () => []);
for (let n = 0; n < count; n++) {
  if (order[n] < 0) {
    continue;
  }
  for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += es) {
    if (!isWeak(e)) {
      preds[edges[e + eTo] / ns].push(n);
    }
  }
}

const idom = new Int32Array(count).fill(-1);
idom[0] = 0;
const intersect = (a, b) => {
  while (a !== b) {
    while (order[a] < order[b]) {
      a = idom[a];
    }
    while (order[b] < order[a]) {
      b = idom[b];
    }
  }
  return a;
};
for (let changed = true; changed;) {
  changed = false;
  for (let i = post.length - 2; i >= 0; i--) {
    const n = post[i];
    let dom = -1;
    for (const p of preds[n]) {
      if (idom[p] === -1) {
        continue;
      }
      dom = dom === -1 ? p : intersect(p, dom);
    }
    if (dom !== -1 && idom[n] !== dom) {
      idom[n] = dom;
      changed = true;
    }
  }
}

// Retained size: own size plus everything dominated, summed bottom-up in postorder.
const retained = new Float64Array(count);
let total = 0;
for (const n of post) {
  retained[n] += nodes[n * ns + nSize];
  total += nodes[n * ns + nSize];
  if (n !== 0) {
    retained[idom[n]] += retained[n];
  }
}

// One path from the root to each node, by breadth-first search over strong edges.
const via = new Int32Array(count).fill(-1);
const viaEdge = new Int32Array(count).fill(-1);
const queue = [0];
via[0] = 0;
for (let q = 0; q < queue.length; q++) {
  const n = queue[q];
  for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += es) {
    const to = edges[e + eTo] / ns;
    if (isWeak(e) || via[to] !== -1) {
      continue;
    }
    via[to] = n;
    viaEdge[to] = e;
    queue.push(to);
  }
}
const pathTo = (n) => {
  const parts = [];
  for (let cur = n; cur !== 0 && parts.length < PATH_DEPTH; cur = via[cur]) {
    parts.unshift(edgeLabel(viaEdge[cur]));
  }
  return parts.join(".");
};

const name = (n) => {
  const type = nodeTypes[nodes[n * ns + nType]];
  const label = strings[nodes[n * ns + nName]].slice(0, 50);
  return type === "object" || type === "closure" ? label : `(${type}) ${label}`;
};

// Biggest retainers that are not just a wrapper around a bigger child.
const top = Number(topArg ?? DEFAULT_TOP);
const candidates = [];
for (let n = 1; n < count; n++) {
  if (order[n] < 0 || retained[n] < total * MIN_SHARE) {
    continue;
  }
  const type = nodeTypes[nodes[n * ns + nType]];
  if (type === "synthetic" || type === "hidden") {
    continue;
  }
  candidates.push(n);
}
candidates.sort((a, b) => retained[b] - retained[a]);

console.log(`total ${(total / MB).toFixed(1)} MB`);
for (const n of candidates.slice(0, top)) {
  console.log(
    `${(retained[n] / MB).toFixed(2).padStart(7)} MB  ${name(n).padEnd(32)} ${pathTo(n)}`,
  );
}
