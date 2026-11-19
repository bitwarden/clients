// Drives the kitchen sink "Table V2 Stress" story and times its interactions.
//
// Usage (Storybook must already be running, default http://localhost:6006):
//   node scripts/perf/table-v2-stress.mjs [--url http://localhost:6006] [--runs 3]
//     [--cpu-throttle 4] [--rows 23000] [--folders 3000] [--page-size 25]
//     [--profile out.cpuprofile] [--headed] [--channel chrome|chromium]
//
// Each scenario reports wall-clock time from dispatching the interaction until the next two
// animation frames (so Angular change detection, layout and paint are all included), plus the
// count and total duration of long tasks (>50ms) observed in that window. With --profile, a V8
// CPU profile of the whole run is written and its heaviest self-time functions are printed.
//
// Reference (M-series laptop, --runs 3 --cpu-throttle 4, medians in ms, 23k rows / 3k folders):
//
//   scenario                      main before PM-47044   main @ ce8c2993   CL-1430 stack @ bb761340
//   open Shared folders                    10,567              4,316               287
//   search inside (~100 matches)            5,107              5,712                38
//   tick a leaf (1st / 2nd)           6,187 / 5,346          513 / 135         271 / 121
//   clear menu search                       3,465              3,415                41
//   expand a parent                         2,849              2,469                48
//   tick a parent (11 selected)             6,769                485               369
//   close menu                              1,149              1,095                61
//
// Unthrottled, divide by roughly four. Initial render is dominated by the Storybook dev build
// and is not comparable across runs.

import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { chromium } from "playwright";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:6006" },
    runs: { type: "string", default: "3" },
    "cpu-throttle": { type: "string", default: "1" },
    profile: { type: "string" },
    headed: { type: "boolean", default: false },
    // The installed Google Chrome by default, so no `playwright install` download is needed.
    channel: { type: "string", default: "chrome" },
    story: { type: "string", default: "documentation-kitchen-sink--table-v-2-stress" },
    // Story args; unset ones keep the story's defaults.
    rows: { type: "string" },
    folders: { type: "string" },
    "page-size": { type: "string" },
  },
});

const runs = Number(args.runs);
const cpuThrottle = Number(args["cpu-throttle"]);
const storyArgs = Object.entries({
  rows: args.rows,
  sharedFolders: args.folders,
  pageSize: args["page-size"],
})
  .filter(([, value]) => value !== undefined)
  .map(([key, value]) => `${key}:${value}`)
  .join(";");
const storyUrl = `${args.url}/iframe.html?id=${args.story}&viewMode=story${
  storyArgs ? `&args=${storyArgs}` : ""
}`;

/** Installed into the page once; scenarios call `__perf.measure(...)`. */
const PAGE_HELPERS = () => {
  const settle = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const measure = async (action) => {
    const longTasks = [];
    const observer = new PerformanceObserver((list) => longTasks.push(...list.getEntries()));
    observer.observe({ type: "longtask", buffered: false });
    const start = performance.now();
    await action();
    await settle();
    const wall = performance.now() - start;
    // Long task entries are delivered asynchronously; yield once so the final one lands.
    await new Promise((resolve) => setTimeout(resolve, 0));
    observer.disconnect();
    return {
      wall,
      longTaskCount: longTasks.length,
      longTaskTotal: longTasks.reduce((sum, t) => sum + t.duration, 0),
    };
  };

  const waitFor = (predicate, timeoutMs = 30_000) =>
    new Promise((resolve, reject) => {
      const deadline = performance.now() + timeoutMs;
      const tick = () => {
        const result = predicate();
        if (result) {
          resolve(result);
        } else if (performance.now() > deadline) {
          reject(new Error("waitFor timed out"));
        } else {
          requestAnimationFrame(tick);
        }
      };
      tick();
    });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const byText = (selector, text) =>
    $$(selector).find((el) => el.textContent?.trim().startsWith(text)) ?? null;
  // Option rows a user can see: a virtualized menu also stamps hidden `inert` sizer rows.
  const rows = (extra = "") =>
    $$(`[data-filter-option-row]${extra}`).filter((el) => !el.closest("[inert]"));

  const click = (el) => {
    if (!el) {
      throw new Error("click target not found");
    }
    el.click();
  };

  // Drives Angular's `bit-search` through its native input so the form control sees the change.
  const typeInto = (input, text) => {
    if (!input) {
      throw new Error("input not found");
    }
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // The menu's scroll region, virtualized or not; parents are sparse so scenarios start at the top.
  const scrollMenuTop = async () => {
    for (const el of $$(
      ".cdk-overlay-container cdk-virtual-scroll-viewport, [data-filter-scroll]",
    )) {
      el.scrollTop = 0;
    }
    // A virtualized list re-renders its rows after the scroll, so wait for a parent to be in view.
    await waitFor(() => rows("[aria-expanded]").length > 0);
    await settle();
  };

  window.__perf = {
    settle,
    measure,
    waitFor,
    $,
    $$,
    rows,
    byText,
    click,
    typeInto,
    scrollMenuTop,
  };
};

/** Closes the open menu by clicking its backdrop, as a click outside would. */
const closeMenu = (name) => ({
  name,
  run: async () => {
    const { measure, waitFor, $, rows, click } = window.__perf;
    return measure(async () => {
      click($(".cdk-overlay-backdrop"));
      await waitFor(() => rows().length === 0);
    });
  },
});

/**
 * Opens a chip's menu and waits for its rows. A virtualized menu renders only the rows in
 * view, so this waits for the chip to report open plus at least one row, not a row count.
 */
const openMenu = (name, chipText) => ({
  name,
  // Passed through `page.evaluate` as an argument: the function is serialized without its closure.
  arg: chipText,
  run: async (chipText) => {
    const { measure, byText, click, waitFor, $, rows } = window.__perf;
    return measure(async () => {
      click(byText("bit-filter-menu button", chipText));
      await waitFor(
        () =>
          $("bit-filter-menu button[aria-expanded=true]") &&
          rows().some((row) => row.querySelector("input")),
      );
    });
  },
});

/**
 * Ticks the first unselected option, whether the menu uses radios or checkboxes. With
 * `rowSelector`, only rows matching it qualify (e.g. `[aria-expanded]` for tree parents).
 */
const selectOption = (name, rowSelector = "") => ({
  name,
  arg: rowSelector,
  run: async (rowSelector) => {
    const { measure, rows, click, scrollMenuTop } = window.__perf;
    if (rowSelector === "[aria-expanded]") {
      await scrollMenuTop();
    }
    const checked = () => rows().filter((row) => row.querySelector("input:checked")).length;
    const before = checked();
    const sample = await measure(async () =>
      click(
        rows(rowSelector)
          .map((row) => row.querySelector("input"))
          .find((el) => el && !el.checked),
      ),
    );
    if (checked() <= before) {
      throw new Error("tick did not add a selection");
    }
    return sample;
  },
});

const menuSearch = (name, term) => ({
  name,
  arg: term,
  run: async (term) => {
    const { measure, $, rows, typeInto, waitFor } = window.__perf;
    // The term applies asynchronously, so wait for the list to actually change.
    const snapshot = () =>
      `${$("[data-filter-result-count]")?.textContent.trim()}|${rows()
        .map((row) => row.textContent.trim())
        .join()}`;
    const before = snapshot();
    return measure(async () => {
      typeInto($("[data-filter-search] input"), term);
      await waitFor(() => snapshot() !== before);
    });
  },
});

// Menus stay open after a pick, so each is closed explicitly.
const SCENARIOS = [
  openMenu("open Shared folders", "Shared folders"),
  menuSearch("search inside Shared folders (~100 matches)", "folder 00"),
  selectOption("tick a Shared folder (1st)", ":not([aria-expanded])"),
  selectOption("tick a Shared folder (2nd)", ":not([aria-expanded])"),
  menuSearch("clear Shared folders search", ""),
  {
    name: "expand a parent folder",
    run: async () => {
      const { measure, rows, click, scrollMenuTop, waitFor } = window.__perf;
      // Parents are one row in fifty, so start from the top where the first one lives.
      await scrollMenuTop();
      const row = rows("[aria-expanded=false]")[0];
      // Virtualized rows are re-created on change, so find the row again by its label.
      const label = row.textContent.trim();
      return measure(async () => {
        click(row.querySelector("[data-filter-expander], button"));
        await waitFor(() =>
          rows("[aria-expanded=true]").some((el) => el.textContent.trim() === label),
        );
      });
    },
  },
  selectOption("tick a parent folder (selects subtree)", "[aria-expanded]"),
  closeMenu("close Shared folders (click outside)"),
  openMenu("open 50-option multi filter (Features)", "Features"),
  selectOption("toggle a Features option"),
  closeMenu("close Features menu (click outside)"),
  {
    name: "table search: type 'Product 0001'",
    run: async () => {
      const { measure, $, typeInto } = window.__perf;
      return measure(async () => typeInto($("bit-table-toolbar bit-search input"), "Product 0001"));
    },
  },
  {
    name: "table search: clear",
    run: async () => {
      const { measure, $, typeInto } = window.__perf;
      return measure(async () => typeInto($("bit-table-toolbar bit-search input"), ""));
    },
  },
  {
    name: "sort by User column",
    run: async () => {
      const { measure, byText, click } = window.__perf;
      return measure(async () => click(byText("[role=columnheader] button", "User")));
    },
  },
  {
    name: "next page",
    run: async () => {
      const { measure, $, click } = window.__perf;
      return measure(async () => click($("bit-table-paginator button[aria-label='Next page']")));
    },
  },
  {
    name: "clear all filters",
    run: async () => {
      const { measure, $, click } = window.__perf;
      return measure(async () => click($("#bit-table-toolbar_button_clear-all")));
    },
  },
];

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { median, min: sorted[0], max: sorted[sorted.length - 1] };
}

function summarizeProfile(profile, top = 20) {
  const selfTime = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    const frame = node.callFrame;
    const key = `${frame.functionName || "(anonymous)"} ${frame.url.split("/").pop()}:${frame.lineNumber + 1}`;
    selfTime.set(key, (selfTime.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0));
  }
  return [...selfTime.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([fn, micros]) => ({ fn, ms: Math.round(micros / 1000) }));
}

const browser = await chromium.launch({ headless: !args.headed, channel: args.channel });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
if (cpuThrottle > 1) {
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottle });
}
if (args.profile) {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
}

const results = new Map();
const record = (name, sample) => {
  const entry = results.get(name) ?? { wall: [], longTaskCount: [], longTaskTotal: [] };
  entry.wall.push(sample.wall);
  entry.longTaskCount.push(sample.longTaskCount);
  entry.longTaskTotal.push(sample.longTaskTotal);
  results.set(name, entry);
};

for (let run = 0; run < runs; run++) {
  await page.goto(storyUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(PAGE_HELPERS);
  const initial = await page.evaluate(async () => {
    const { waitFor } = window.__perf;
    await waitFor(() => document.querySelectorAll("bit-table-v2 bit-row").length > 0);
    // Relative to navigation start, so it includes bundle load + bootstrap + first table render.
    return { wall: performance.now(), longTaskCount: 0, longTaskTotal: 0 };
  });
  record("initial render (nav → first row)", initial);

  for (const scenario of SCENARIOS) {
    try {
      const sample = await page.evaluate(scenario.run, scenario.arg);
      record(scenario.name, sample);
    } catch (e) {
      record(scenario.name, { wall: NaN, longTaskCount: NaN, longTaskTotal: NaN });
      console.error(`[run ${run + 1}] ${scenario.name}: ${e.message}`);
    }
  }
}

if (args.profile) {
  const { profile } = await cdp.send("Profiler.stop");
  await writeFile(args.profile, JSON.stringify(profile));
  console.log(`\nCPU profile written to ${args.profile} (load in DevTools › Performance)`);
  console.log("Top self-time functions:");
  console.table(summarizeProfile(profile));
}

await browser.close();

console.log(
  `\nStory: ${storyUrl}\nRuns: ${runs}  CPU throttle: ${cpuThrottle}x  (times in ms, median [min–max])\n`,
);
const table = [...results.entries()].map(([name, r]) => {
  const w = stats(r.wall);
  const lt = stats(r.longTaskTotal);
  return {
    scenario: name,
    wall: `${w.median.toFixed(0)} [${w.min.toFixed(0)}–${w.max.toFixed(0)}]`,
    longTasks: `${stats(r.longTaskCount).median}`,
    longTaskMs: `${lt.median.toFixed(0)} [${lt.min.toFixed(0)}–${lt.max.toFixed(0)}]`,
  };
});
console.table(table);
