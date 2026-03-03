/* eslint-disable no-console */

/// Scans the codebase for ESLint disable comments and generates a report with
/// per-rule and per-area breakdowns. Supports JSON output and filtering.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// --- Types ---

type DisableType =
  | "eslint-disable"
  | "eslint-disable-next-line"
  | "eslint-disable-line"
  | "ts-ignore"
  | "ts-expect-error"
  | "html-eslint-disable";

interface DisableEntry {
  filePath: string;
  line: number;
  type: DisableType;
  rules: string[];
}

interface RuleStat {
  rule: string;
  count: number;
  percentage: number;
  files: number;
}

interface AreaStat {
  area: string;
  total: number;
  byType: Record<DisableType, number>;
  topRules: RuleStat[];
}

interface ReportSummary {
  totalDisables: number;
  totalBlanketDisables: number;
  uniqueRules: number;
  filesWithDisables: number;
  totalFilesScanned: number;
  byType: Record<DisableType, number>;
}

interface DisableReport {
  timestamp: string;
  gitSha: string;
  summary: ReportSummary;
  rules: RuleStat[];
  areas: AreaStat[];
}

interface Args {
  json: boolean;
  area: string | null;
  rule: string | null;
}

// --- Constants ---

const MAX_TOP_RULES = 50;
const ROOT_DIR = path.join(__dirname, "..", "..");
const SOURCE_ROOTS = ["apps", "libs", "bitwarden_license"];
const EXTENSIONS = new Set([".ts", ".js", ".html"]);
const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".angular",
  "storybook-static",
]);

const ALL_DISABLE_TYPES: DisableType[] = [
  "eslint-disable-next-line",
  "eslint-disable",
  "eslint-disable-line",
  "html-eslint-disable",
  "ts-ignore",
  "ts-expect-error",
];

// --- Regex Patterns ---

const PATTERNS: Array<{ regex: RegExp; type: DisableType }> = [
  // // eslint-disable-next-line [rule1, rule2]
  {
    regex: /\/\/\s*eslint-disable-next-line(?:\s+(.+))?$/,
    type: "eslint-disable-next-line",
  },
  // // eslint-disable-line [rule1, rule2]
  {
    regex: /\/\/\s*eslint-disable-line(?:\s+(.+))?$/,
    type: "eslint-disable-line",
  },
  // /* eslint-disable [rule1, rule2] */ (self-closing on one line)
  {
    regex: /\/\*\s*eslint-disable(?!\s*-)\s*([^*]*?)\s*\*\//,
    type: "eslint-disable",
  },
  // /* eslint-disable [rules] (open-ended, file-level)
  {
    regex: /\/\*\s*eslint-disable(?!\s*-)(?:\s+(.+))?\s*$/,
    type: "eslint-disable",
  },
  // <!-- eslint-disable[-next-line] [rules] -->
  {
    regex: /<!--\s*eslint-disable(?:-next-line)?(?:\s+([^-][^>]*?))?\s*-->/,
    type: "html-eslint-disable",
  },
  // // @ts-ignore
  {
    regex: /\/\/\s*@ts-ignore/,
    type: "ts-ignore",
  },
  // // @ts-expect-error
  {
    regex: /\/\/\s*@ts-expect-error/,
    type: "ts-expect-error",
  },
];

// --- Argument Parsing ---

function parseArgs(argv: string[]): Args {
  const args: Args = {
    json: false,
    area: null,
    rule: null,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--json":
        args.json = true;
        break;
      case "--area":
        args.area = argv[++i];
        break;
      case "--rule":
        args.rule = argv[++i];
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        console.error("Usage: lint-disable-report [--json] [--area <prefix>] [--rule <name>]");
        process.exit(1);
    }
  }

  return args;
}

// --- File Discovery ---

function discoverFiles(areaFilter: string | null): string[] {
  const files: string[] = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const fullPath = path.join(ROOT_DIR, sourceRoot);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const entries = fs.readdirSync(fullPath, { recursive: true, encoding: "utf-8" });
    for (const entry of entries) {
      const parts = entry.split(path.sep);
      if (parts.some((p) => IGNORE_DIRS.has(p))) {
        continue;
      }
      if (!EXTENSIONS.has(path.extname(entry))) {
        continue;
      }

      const relativePath = path.join(sourceRoot, entry);
      if (areaFilter && !relativePath.startsWith(areaFilter)) {
        continue;
      }

      files.push(relativePath);
    }
  }

  return files;
}

// --- Comment Parsing ---

function extractRules(ruleString: string | undefined): string[] {
  if (!ruleString || !ruleString.trim()) {
    return [];
  }

  return ruleString
    .split(",")
    .map((r) => r.replace(/\s+--\s+.*$/, "").trim())
    .filter((r) => r.length > 0 && !r.startsWith("--"));
}

function parseDisableComments(filePath: string, content: string): DisableEntry[] {
  const entries: DisableEntry[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const pattern of PATTERNS) {
      const match = line.match(pattern.regex);
      if (match) {
        const rules = extractRules(match[1]);
        entries.push({
          filePath,
          line: i + 1,
          type: pattern.type,
          rules,
        });
        break; // only match the first pattern per line
      }
    }
  }

  return entries;
}

// --- Area Classification ---

function classifyArea(filePath: string): string {
  const parts = filePath.split(path.sep);

  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return parts[0];
}

// --- Report Building ---

function emptyByType(): Record<DisableType, number> {
  return {
    "eslint-disable-next-line": 0,
    "eslint-disable": 0,
    "eslint-disable-line": 0,
    "html-eslint-disable": 0,
    "ts-ignore": 0,
    "ts-expect-error": 0,
  };
}

function buildReport(
  entries: DisableEntry[],
  totalFilesScanned: number,
  ruleFilter: string | null,
): DisableReport {
  // Expand multi-rule entries into individual rule records for counting
  const expandedRules: Array<{ rule: string; filePath: string; type: DisableType }> = [];
  let blanketCount = 0;

  for (const entry of entries) {
    if (entry.rules.length === 0) {
      blanketCount++;
      expandedRules.push({ rule: "(blanket)", filePath: entry.filePath, type: entry.type });
    } else {
      for (const rule of entry.rules) {
        expandedRules.push({ rule, filePath: entry.filePath, type: entry.type });
      }
    }
  }

  // Apply rule filter
  const filtered = ruleFilter ? expandedRules.filter((r) => r.rule === ruleFilter) : expandedRules;

  const totalDisables = filtered.length;

  // By type
  const byType = emptyByType();
  for (const r of filtered) {
    byType[r.type]++;
  }

  // Per-rule stats
  const ruleMap = new Map<string, { count: number; files: Set<string> }>();
  for (const r of filtered) {
    let stat = ruleMap.get(r.rule);
    if (!stat) {
      stat = { count: 0, files: new Set() };
      ruleMap.set(r.rule, stat);
    }
    stat.count++;
    stat.files.add(r.filePath);
  }

  const rules: RuleStat[] = Array.from(ruleMap.entries())
    .map(([rule, stat]) => ({
      rule,
      count: stat.count,
      percentage: totalDisables > 0 ? round((stat.count / totalDisables) * 100, 1) : 0,
      files: stat.files.size,
    }))
    .sort((a, b) => b.count - a.count);

  // Per-area stats
  const areaMap = new Map<
    string,
    {
      total: number;
      byType: Record<DisableType, number>;
      ruleMap: Map<string, { count: number; files: Set<string> }>;
    }
  >();

  for (const r of filtered) {
    const area = classifyArea(r.filePath);
    let stat = areaMap.get(area);
    if (!stat) {
      stat = { total: 0, byType: emptyByType(), ruleMap: new Map() };
      areaMap.set(area, stat);
    }
    stat.total++;
    stat.byType[r.type]++;

    let ruleStat = stat.ruleMap.get(r.rule);
    if (!ruleStat) {
      ruleStat = { count: 0, files: new Set() };
      stat.ruleMap.set(r.rule, ruleStat);
    }
    ruleStat.count++;
    ruleStat.files.add(r.filePath);
  }

  const areas: AreaStat[] = Array.from(areaMap.entries())
    .map(([area, stat]) => ({
      area,
      total: stat.total,
      byType: stat.byType,
      topRules: Array.from(stat.ruleMap.entries())
        .map(([rule, rs]) => ({
          rule,
          count: rs.count,
          percentage: stat.total > 0 ? round((rs.count / stat.total) * 100, 1) : 0,
          files: rs.files.size,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    }))
    .sort((a, b) => b.total - a.total);

  // Files with disables
  const filesWithDisables = new Set(filtered.map((r) => r.filePath)).size;

  // Unique rules
  const uniqueRules = new Set(filtered.map((r) => r.rule)).size;

  // Git SHA
  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { cwd: ROOT_DIR, encoding: "utf-8" }).trim();
  } catch {
    // ignore if not in a git repo
  }

  return {
    timestamp: new Date().toISOString(),
    gitSha,
    summary: {
      totalDisables,
      totalBlanketDisables: ruleFilter ? 0 : blanketCount,
      uniqueRules,
      filesWithDisables,
      totalFilesScanned,
      byType,
    },
    rules,
    areas,
  };
}

// --- Terminal Output ---

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function printTerminalReport(report: DisableReport): void {
  console.log("");
  console.log("=== ESLint Disable Report ===");
  console.log(`Generated: ${report.timestamp} | Commit: ${report.gitSha}`);

  // --- Summary ---
  console.log("");
  console.log("--- Summary ---");
  console.log(
    `Total disables:              ${padLeft(formatNumber(report.summary.totalDisables), 7)}`,
  );

  for (const type of ALL_DISABLE_TYPES) {
    const count = report.summary.byType[type] ?? 0;
    if (count > 0) {
      console.log(`  ${padRight(type + ":", 28)} ${padLeft(formatNumber(count), 7)}`);
    }
  }

  console.log(
    `Blanket disables (no rule):  ${padLeft(formatNumber(report.summary.totalBlanketDisables), 7)}`,
  );
  console.log(
    `Unique rules disabled:       ${padLeft(formatNumber(report.summary.uniqueRules), 7)}`,
  );
  console.log(
    `Files with disables:     ${padLeft(formatNumber(report.summary.filesWithDisables), 7)} / ${formatNumber(report.summary.totalFilesScanned)}`,
  );

  // --- Top Rules ---
  console.log("");
  console.log(`--- Top ${MAX_TOP_RULES} Rules ---`);
  const ruleNumW = 3;
  const ruleNameW = 58;
  const ruleCountW = 8;
  const rulePctW = 7;
  const ruleFilesW = 7;

  console.log(
    ` ${padLeft("#", ruleNumW)}  ${padRight("Rule", ruleNameW)}  ${padLeft("Count", ruleCountW)}  ${padLeft("%", rulePctW)}  ${padLeft("Files", ruleFilesW)}`,
  );

  const topRules = report.rules.slice(0, MAX_TOP_RULES);
  for (let i = 0; i < topRules.length; i++) {
    const r = topRules[i];
    const name = r.rule.length > ruleNameW ? r.rule.slice(0, ruleNameW - 2) + ".." : r.rule;
    console.log(
      ` ${padLeft(String(i + 1), ruleNumW)}  ${padRight(name, ruleNameW)}  ${padLeft(formatNumber(r.count), ruleCountW)}  ${padLeft(r.percentage.toFixed(1) + "%", rulePctW)}  ${padLeft(formatNumber(r.files), ruleFilesW)}`,
    );
  }

  if (report.rules.length > MAX_TOP_RULES) {
    console.log(`  ... and ${report.rules.length - MAX_TOP_RULES} more rules`);
  }

  // --- By Area ---
  console.log("");
  console.log("--- By Area ---");
  const areaNameW = 32;
  const areaColW = 8;

  const areaHeader =
    ` ${padRight("Area", areaNameW)}  ${padLeft("Total", areaColW)}` +
    `  ${padLeft("next-ln", areaColW)}  ${padLeft("block", areaColW)}` +
    `  ${padLeft("line", areaColW)}  ${padLeft("html", areaColW)}` +
    `  ${padLeft("ts-ign", areaColW)}  ${padLeft("ts-exp", areaColW)}`;
  console.log(areaHeader);

  for (const area of report.areas) {
    const name =
      area.area.length > areaNameW ? area.area.slice(0, areaNameW - 2) + ".." : area.area;
    console.log(
      ` ${padRight(name, areaNameW)}  ${padLeft(formatNumber(area.total), areaColW)}` +
        `  ${padLeft(formatNumber(area.byType["eslint-disable-next-line"]), areaColW)}` +
        `  ${padLeft(formatNumber(area.byType["eslint-disable"]), areaColW)}` +
        `  ${padLeft(formatNumber(area.byType["eslint-disable-line"]), areaColW)}` +
        `  ${padLeft(formatNumber(area.byType["html-eslint-disable"]), areaColW)}` +
        `  ${padLeft(formatNumber(area.byType["ts-ignore"]), areaColW)}` +
        `  ${padLeft(formatNumber(area.byType["ts-expect-error"]), areaColW)}`,
    );
  }

  console.log("");
}

// --- Main ---

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  // Discover and scan files
  const files = discoverFiles(args.area);
  const allEntries: DisableEntry[] = [];

  for (const file of files) {
    const fullPath = path.join(ROOT_DIR, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const entries = parseDisableComments(file, content);
    allEntries.push(...entries);
  }

  // Build report
  const report = buildReport(allEntries, files.length, args.rule);

  // Output
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTerminalReport(report);
  }
}

main();
