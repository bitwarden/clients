#!/usr/bin/env node
// @ts-check

/**
 * Channel manifest generator.
 *
 * Phase 6 §10 of personal/IMPL-extension-messaging-framework.md.
 *
 * Walks `apps/browser/src/**` for calls to `defineNotice`, `defineRequest`,
 * `defineContentNotice`, and `defineContentRequest`. For each call it records:
 *
 *   - command       (string literal at the `command:` property)
 *   - envPair       (string literal at the `envPair:` property)
 *   - schema        (identifier at the `schema:` property, if any)
 *   - middleware    (identifiers in the `middleware:` array, if any)
 *   - factory       (which define* helper was used — implies the wire shape)
 *   - file          (relative path of the call site)
 *
 * The result is written to `apps/browser/channel-manifest.json` as a sorted,
 * stable list (sort key: `${command}|${envPair}|${file}`). A CI check runs
 * `node scripts/build-channel-manifest.mjs --check` after the regular run and
 * exits non-zero if the file on disk differs from what was just generated —
 * forcing PRs that add channels to update the manifest in the same commit.
 *
 * Usage:
 *   node scripts/build-channel-manifest.mjs           # write
 *   node scripts/build-channel-manifest.mjs --check   # verify
 *   node scripts/build-channel-manifest.mjs --markdown # write audit doc
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const BROWSER_SRC = resolve(__dirname, "..", "src");
const MANIFEST_PATH = resolve(__dirname, "..", "channel-manifest.json");
const MARKDOWN_PATH = resolve(__dirname, "..", "channel-manifest.md");

const FACTORY_NAMES = new Set([
  "defineNotice",
  "defineRequest",
  "defineContentNotice",
  "defineContentRequest",
]);

/** @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) {
        continue;
      }
      out.push(...walk(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".spec.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Read a string-literal property from an ObjectLiteralExpression, returning
 * the literal value if present and a string, otherwise undefined.
 *
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} key
 */
function readStringProp(obj, key) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (!ts.isIdentifier(prop.name) || prop.name.text !== key) continue;
    if (ts.isStringLiteralLike(prop.initializer)) {
      return prop.initializer.text;
    }
  }
  return undefined;
}

/**
 * Read an identifier-valued property (e.g. `schema: MySchema`).
 *
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} key
 */
function readIdentifierProp(obj, key) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (!ts.isIdentifier(prop.name) || prop.name.text !== key) continue;
    if (ts.isIdentifier(prop.initializer)) {
      return prop.initializer.text;
    }
    // Don't try to resolve complex expressions; flag them for review.
    return "<computed>";
  }
  return undefined;
}

/**
 * Read an array-of-identifiers property (e.g. `middleware: [a, b]`).
 *
 * @param {ts.ObjectLiteralExpression} obj
 * @param {string} key
 * @returns {string[] | undefined}
 */
function readIdentifierArrayProp(obj, key) {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    if (!ts.isIdentifier(prop.name) || prop.name.text !== key) continue;
    if (!ts.isArrayLiteralExpression(prop.initializer)) return undefined;
    return prop.initializer.elements.map((el) => {
      if (ts.isIdentifier(el)) return el.text;
      if (ts.isCallExpression(el) && ts.isIdentifier(el.expression)) {
        return `${el.expression.text}(...)`;
      }
      return "<computed>";
    });
  }
  return undefined;
}

/**
 * @typedef {{
 *   factory: string;
 *   command: string | undefined;
 *   envPair: string | undefined;
 *   schema: string | undefined;
 *   middleware: string[] | undefined;
 *   file: string;
 * }} ChannelEntry
 */

/**
 * @param {string} file
 * @returns {ChannelEntry[]}
 */
function extractFromFile(file) {
  const source = readFileSync(file, "utf-8");
  // Quick lexical filter — skip files that can't possibly contain a factory call.
  let mentionsFactory = false;
  for (const name of FACTORY_NAMES) {
    if (source.includes(name)) {
      mentionsFactory = true;
      break;
    }
  }
  if (!mentionsFactory) {
    return [];
  }
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  /** @type {ChannelEntry[]} */
  const out = [];

  /** @param {ts.Node} node */
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const factory = node.expression.text;
      if (FACTORY_NAMES.has(factory) && node.arguments.length > 0) {
        const arg = node.arguments[0];
        if (ts.isObjectLiteralExpression(arg)) {
          out.push({
            factory,
            command: readStringProp(arg, "command"),
            envPair: readStringProp(arg, "envPair"),
            schema: readIdentifierProp(arg, "schema"),
            middleware: readIdentifierArrayProp(arg, "middleware"),
            file: relative(REPO_ROOT, file),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

function generate() {
  const files = walk(BROWSER_SRC);
  /** @type {ChannelEntry[]} */
  const channels = [];
  for (const file of files) {
    channels.push(...extractFromFile(file));
  }
  channels.sort((a, b) => {
    const key = (/** @type {ChannelEntry} */ c) =>
      `${c.command ?? "~"}|${c.envPair ?? "~"}|${c.file}`;
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
  return channels;
}

function toJson(channels) {
  // Trailing newline so editors/git see a clean POSIX text file.
  return (
    JSON.stringify({ generated: { tool: "build-channel-manifest" }, channels }, null, 2) + "\n"
  );
}

function toMarkdown(channels) {
  const lines = [
    "# Channel manifest",
    "",
    `Generated by \`apps/browser/scripts/build-channel-manifest.mjs\`. Do not edit by hand — re-run the script after adding or modifying a handle.`,
    "",
    `Channels: **${channels.length}**`,
    "",
    "| Command | EnvPair | Factory | Schema | Middleware | File |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const c of channels) {
    lines.push(
      `| \`${c.command ?? "?"}\` | \`${c.envPair ?? "?"}\` | \`${c.factory}\` | ${
        c.schema ? `\`${c.schema}\`` : "—"
      } | ${c.middleware?.length ? c.middleware.map((m) => `\`${m}\``).join(", ") : "—"} | \`${c.file}\` |`,
    );
  }
  return lines.join("\n") + "\n";
}

const mode = process.argv[2];
const channels = generate();
const json = toJson(channels);

if (mode === "--check") {
  if (!existsSync(MANIFEST_PATH)) {
    process.stderr.write(
      `channel-manifest.json does not exist. Run without --check to create it.\n`,
    );
    process.exit(1);
  }
  const current = readFileSync(MANIFEST_PATH, "utf-8");
  if (current !== json) {
    process.stderr.write(
      `channel-manifest.json is out of date. Regenerate with:\n  node apps/browser/scripts/build-channel-manifest.mjs\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`channel-manifest.json up to date (${channels.length} channels).\n`);
  process.exit(0);
}

if (mode === "--markdown") {
  writeFileSync(MARKDOWN_PATH, toMarkdown(channels));
  process.stdout.write(`Wrote ${MARKDOWN_PATH} (${channels.length} channels).\n`);
}

writeFileSync(MANIFEST_PATH, json);
process.stdout.write(`Wrote ${MANIFEST_PATH} (${channels.length} channels).\n`);
