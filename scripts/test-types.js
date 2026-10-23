const concurrently = require("concurrently");
const os = require("os");
const path = require("path");
const fs = require("fs");

// Each tsc process resolves `tsconfig.base.json` path aliases into much of the monorepo and peaks
// around 1 GB of memory, so cap concurrency by available memory as well as CPU cores.
const estimatedMemoryPerProcessInBytes = 2 * 1024 ** 3;
const maxProcesses =
  Number(process.env.TEST_TYPES_MAX_PROCESSES) ||
  Math.max(
    1,
    Math.min(
      os.availableParallelism(),
      Math.floor(os.totalmem() / estimatedMemoryPerProcessInBytes),
    ),
  );

function getFiles(dir) {
  results = [];
  fs.readdirSync(dir).forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = getFiles(path.join(__dirname, "..", "libs"))
  .filter((file) => {
    const name = path.basename(file);
    return name === "tsconfig.json";
  })
  .filter((path) => {
    // Exclude shared since it's not actually a library
    return !path.includes("libs/shared/");
  });

concurrently(
  [
    {
      // run the strict type check plugin until we're fully converted, then update tsconfig.json to use strict
      name: "typescript-strict-plugin",
      command: "npx tsc-strict",
    },
    ...files.map((file) => ({
      name: path.basename(path.dirname(file)),
      command: `npx tsc --noEmit --project ${file}`,
    })),
  ],
  { maxProcesses },
);
