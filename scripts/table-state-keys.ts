/* eslint-disable no-console */

/// Ensure every `bit-table-v2` `stateKey` is unique. Two tables sharing a key share one stored
/// set of hidden columns, so one table's "Reset to default" clears the other's. A scan rather
/// than an ESLint rule because `npm run lint` runs with `--cache`, which would hide unchanged keys.

import fs from "fs";
import path from "path";

const repoRoot = path.join(__dirname, "..", "..");

const SEARCH_ROOTS = ["apps", "libs", "bitwarden_license"];
// `.mdx` is excluded: its examples are prose, not real tables.
const SEARCH_EXTENSIONS = [".html", ".ts"];
const SKIP_DIRECTORIES = ["node_modules", "dist", "build"];

// Skips a property binding — `[stateKey]="key()"` — whose value is an expression this can't
// resolve. The lookbehind rules out a TS property of the same name, as in `user-state-subject.ts`.
const STATE_KEY = /(?<![\w.])stateKey\s*=\s*"([^"]*)"/g;

interface Usage {
  key: string;
  location: string;
}

function collectUsages(): Usage[] {
  const usages: Usage[] = [];

  for (const root of SEARCH_ROOTS) {
    const rootPath = path.join(repoRoot, root);

    for (const entry of fs.readdirSync(rootPath, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !SEARCH_EXTENSIONS.includes(path.extname(entry.name))) {
        continue;
      }

      const filePath = path.join(entry.parentPath, entry.name);
      const relativePath = path.relative(repoRoot, filePath);
      if (relativePath.split(path.sep).some((segment) => SKIP_DIRECTORIES.includes(segment))) {
        continue;
      }

      const lines = fs.readFileSync(filePath, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const match of line.matchAll(STATE_KEY)) {
          usages.push({ key: match[1], location: `${relativePath}:${index + 1}` });
        }
      });
    }
  }

  return usages;
}

// Mirrors the rules `state-definitions.spec.ts` holds state names to.
function validate(usages: Usage[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, Usage>();

  for (const usage of usages) {
    const { key, location } = usage;
    const lower = key.toLowerCase();

    if (key.length <= 3) {
      errors.push(`${location}: key "${key}" is too short to be descriptive.`);
    }
    if (key.includes(" ")) {
      errors.push(`${location}: key "${key}" contains a space. Keys are identifiers, not labels.`);
    }
    if (key !== lower) {
      errors.push(`${location}: key "${key}" must be all lowercase.`);
    }

    // Keyed by lowercase so a casing-only difference collides too.
    const conflict = seen.get(lower);
    if (conflict) {
      errors.push(
        `${location}: key "${key}" is already used by ${conflict.location} ("${conflict.key}"). ` +
          `Two tables sharing a key share one stored set of hidden columns — choose a unique key.`,
      );
    } else {
      seen.set(lower, usage);
    }
  }

  return errors;
}

const usages = collectUsages();
const errors = validate(usages);

if (errors.length > 0) {
  console.error("Invalid table state keys:\n");
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`All ${usages.length} table state keys are unique and well formed.`);
