/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

function readSummary(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Coverage summary not found at ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Unable to parse coverage summary at ${resolvedPath}: ${error.message}`);
  }
}

function getPct(summary, metric) {
  if (!summary.total || !summary.total[metric]) {
    throw new Error(`Coverage metric "${metric}" not present in summary`);
  }

  const pct = summary.total[metric].pct;
  if (typeof pct !== "number" || Number.isNaN(pct)) {
    throw new Error(`Coverage metric "${metric}" is not a number`);
  }

  return pct;
}

const headPath = process.env.HEAD_COVERAGE_PATH || "coverage/coverage-summary.json";
const basePath = process.env.BASE_COVERAGE_PATH || "coverage/base-coverage-summary.json";
const metric = (process.env.COVERAGE_METRIC || "lines").toLowerCase();
const toleranceRaw = process.env.COVERAGE_TOLERANCE;
const tolerance = Number.isFinite(parseFloat(toleranceRaw))
  ? Math.max(0, parseFloat(toleranceRaw))
  : 0;

const headSummary = readSummary(headPath);
const baseSummary = readSummary(basePath);

const headPct = getPct(headSummary, metric);
const basePct = getPct(baseSummary, metric);
const normalizedHeadPct = Math.ceil(headPct);
const normalizedBasePct = Math.trunc(basePct);
const diff = normalizedHeadPct - normalizedBasePct;

if (normalizedHeadPct + tolerance < normalizedBasePct) {
  console.error(
    `Coverage regression detected for ${metric}: PR ${normalizedHeadPct}% (raw ${headPct.toFixed(
      2,
    )}%) < base ${normalizedBasePct}% (raw ${basePct.toFixed(2)}%)`,
  );
  process.exit(1);
}

console.log(
  `Coverage check passed for ${metric}: PR ${normalizedHeadPct}% (raw ${headPct.toFixed(
    2,
  )}%) (base ${normalizedBasePct}% (raw ${basePct.toFixed(
    2,
  )}%), diff ${diff}pp${tolerance ? `, tolerance ${tolerance}` : ""}).`,
);
