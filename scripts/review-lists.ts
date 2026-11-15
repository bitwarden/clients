/* eslint-disable no-console */

/// Ensure that every always-review list in .github/review matches CODEOWNERS.
///
/// Each list is .github/review/<team>.yml, where <team> is a team CODEOWNERS names. It holds an
/// `include` key and an optional `exclude` key, each a list of CODEOWNERS patterns. A list narrows
/// what CODEOWNERS assigns to its team, so:
/// - every include entry must be one of the team's own CODEOWNERS lines, and
/// - every include and exclude entry must match at least one tracked file the team owns.
/// A renamed, removed, or overridden CODEOWNERS line therefore fails here, not drifts.

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const repoRoot = path.join(__dirname, "..", "..");
const reviewDir = path.join(repoRoot, ".github", "review");
const codeownersPath = path.join(repoRoot, ".github", "CODEOWNERS");
const ORG = "@bitwarden/";

interface Rule {
  pattern: string;
  regex: RegExp;
  teams: string[];
}

interface Entry {
  key: "include" | "exclude";
  pattern: string;
  line: number;
}

const errors: string[] = [];

/// Compiles a CODEOWNERS pattern to a regular expression over repository paths, following
/// GitHub's CODEOWNERS rules. Returns null for syntax GitHub doesn't support.
function toRegex(source: string): RegExp | null {
  if (source.startsWith("!") || /[[\]]/.test(source)) {
    return null;
  }
  let body = source;
  const dirOnly = body.endsWith("/");
  if (dirOnly) {
    body = body.slice(0, -1);
  }
  // A slash at the start or in the middle anchors the pattern to the root.
  const anchored = body.includes("/");
  if (body.startsWith("/")) {
    body = body.slice(1);
  }
  const segments = body.split("/");
  if (body === "" || segments.some((s) => s === "")) {
    return null;
  }

  let re = anchored ? "^" : "^(?:.*/)?";
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === "**") {
      re += last ? (i === 0 ? ".*" : ".+") : "(?:[^/]+/)*";
      return;
    }
    for (let c = 0; c < segment.length; c++) {
      const ch = segment[c];
      if (ch === "*") {
        while (segment[c + 1] === "*") {
          c++;
        }
        re += "[^/]*";
      } else if (ch === "?") {
        re += "[^/]";
      } else {
        re += ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      }
    }
    if (!last) {
      re += "/";
    }
  });

  // A trailing slash matches directory contents only, and a final `*` matches direct children
  // only. Any other pattern also matches everything under a directory of that name.
  const lastSegment = segments[segments.length - 1];
  if (dirOnly) {
    re += "/.+$";
  } else if (lastSegment === "*" || lastSegment === "**") {
    re += "$";
  } else {
    re += "(?:/.*)?$";
  }
  return new RegExp(re);
}

/// Reads the CODEOWNERS rules in order, with the teams each line names.
function readCodeowners(): Rule[] {
  const rules: Rule[] = [];
  for (const raw of fs.readFileSync(codeownersPath, "utf8").split(/\r?\n/)) {
    const [pattern, ...owners] = raw
      .replace(/\s#.*$/, "")
      .trim()
      .split(/\s+/);
    if (!pattern || pattern.startsWith("#")) {
      continue;
    }
    const regex = toRegex(pattern);
    if (regex === null) {
      continue;
    }
    const teams = owners.filter((o) => o.startsWith(ORG)).map((o) => o.slice(ORG.length));
    rules.push({ pattern, regex, teams });
  }
  return rules;
}

/// Parses a list strictly. `file` is relative to the repository root. Accepts comments, blank lines, the `include` and `exclude` keys, and
/// `- pattern` items under them. Anything else is an error, so a list can't hold a key or value
/// that YAML would read differently from what it looks like.
function readList(file: string): Entry[] {
  const entries: Entry[] = [];
  const seen = new Set<string>();
  let key: Entry["key"] | null = null;

  fs.readFileSync(path.join(repoRoot, file), "utf8")
    .split(/\r?\n/)
    .forEach((raw, index) => {
      const line = index + 1;
      const text = raw.trim();
      if (text === "" || text.startsWith("#")) {
        return;
      }
      const keyMatch = raw.match(/^(\w+):\s*(?:#.*)?$/);
      if (keyMatch) {
        if (keyMatch[1] !== "include" && keyMatch[1] !== "exclude") {
          errors.push(
            `${file}:${line} unknown key '${keyMatch[1]}'. Only include and exclude are allowed.`,
          );
          key = null;
          return;
        }
        key = keyMatch[1];
        seen.add(key);
        return;
      }
      const itemMatch = raw.match(/^\s+-\s+(.+?)\s*$/);
      if (!itemMatch || key === null) {
        errors.push(`${file}:${line} expected '- <pattern>' under include or exclude.`);
        return;
      }
      const value = itemMatch[1];
      const quoted = value.match(/^"(.*)"$/) ?? value.match(/^'(.*)'$/);
      const startsWithWildcard = value.startsWith("*");
      const containsYamlSyntax = /\s#|:\s/.test(value);
      const needsQuotes = startsWithWildcard || containsYamlSyntax;
      if (!quoted && needsQuotes) {
        errors.push(`${file}:${line} quote '${value}'. YAML reads it differently unquoted.`);
        return;
      }
      entries.push({ key, pattern: quoted ? quoted[1] : value, line });
    });

  if (!seen.has("include")) {
    errors.push(`${file}: missing the required include key.`);
  }
  return entries;
}

const rules = readCodeowners();
const trackedFiles = execFileSync("git", ["-C", repoRoot, "ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f !== "");

// Each file's owning teams come from the last CODEOWNERS line that matches it, as on GitHub.
const ownersOf = new Map<string, string[]>();
for (const file of trackedFiles) {
  let teams: string[] = [];
  for (const rule of rules) {
    if (rule.regex.test(file)) {
      teams = rule.teams;
    }
  }
  ownersOf.set(file, teams);
}

const listFiles = fs.readdirSync(reviewDir).filter((f) => f.endsWith(".yml"));
for (const name of listFiles) {
  const team = name.slice(0, -".yml".length);
  const file = path.relative(repoRoot, path.join(reviewDir, name));
  const ownLines = new Set(rules.filter((r) => r.teams.includes(team)).map((r) => r.pattern));
  if (ownLines.size === 0) {
    errors.push(`${file}: ${ORG}${team} is not a team in CODEOWNERS.`);
    continue;
  }

  for (const entry of readList(file)) {
    const where = `${file}:${entry.line}`;
    if (entry.key === "include" && !ownLines.has(entry.pattern)) {
      errors.push(
        `${where} include '${entry.pattern}' is not a CODEOWNERS line for ${ORG}${team}.`,
      );
      continue;
    }
    const regex = toRegex(entry.pattern);
    if (regex === null) {
      errors.push(`${where} '${entry.pattern}' is not a valid CODEOWNERS pattern.`);
      continue;
    }
    const matched = trackedFiles.filter((f) => regex.test(f));
    if (!matched.some((f) => ownersOf.get(f)?.includes(team))) {
      errors.push(
        `${where} ${entry.key} '${entry.pattern}' matches no file ${ORG}${team} owns, so it has no effect.`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Always-review lists don't match CODEOWNERS:");
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`All ${listFiles.length} always-review lists match CODEOWNERS.`);
