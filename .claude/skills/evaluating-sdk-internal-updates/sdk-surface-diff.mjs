#!/usr/bin/env node
// The SDK's TypeScript surface is committed in neither repo; it exists only inside the published
// tarballs. This reconstructs it from two of them and diffs it at member granularity.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const args = process.argv.slice(2);
const commercial = args.includes("--commercial");
const [oldVersion, newVersion] = args.filter((arg) => !arg.startsWith("--"));

if (!oldVersion || !newVersion) {
  console.error("usage: sdk-surface-diff.mjs <old-version> <new-version> [--commercial]");
  process.exit(2);
}

// Both values become an `npm pack` spec and a cache-directory path component. Unvalidated, a
// git URL, file: path, or dist-tag also parses as a spec (running the fetched package's
// `prepare` script on pack), and `..` in the path component escapes the cache directory.
const versionPattern = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
for (const version of [oldVersion, newVersion]) {
  if (!versionPattern.test(version)) {
    fail(`"${version}" is not a version`);
  }
}

const pkg = commercial ? "@bitwarden/commercial-sdk-internal" : "@bitwarden/sdk-internal";
const cache = join(process.env.RUNNER_TEMP ?? tmpdir(), "sdk-surface", pkg.replace(/\W/g, "-"));

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function fetchSurface(version) {
  const dir = join(cache, version);
  const tarball = join(dir, "package");
  const dts = join(tarball, "bitwarden_wasm_internal.d.ts");

  if (!existsSync(dts)) {
    mkdirSync(dir, { recursive: true });
    try {
      execFileSync(
        "npm",
        ["pack", `${pkg}@${version}`, "--pack-destination", dir, "--loglevel=warn"],
        {
          stdio: ["ignore", "ignore", "inherit"],
        },
      );
    } catch (error) {
      fail(`npm pack failed for ${pkg}@${version}: ${error.message}`);
    }
    const tgz = readdirSync(dir).find((file) => file.endsWith(".tgz"));
    if (!tgz) {
      fail(`npm pack produced no tarball for ${pkg}@${version}`);
    }
    try {
      execFileSync("tar", [
        "-xzf",
        join(dir, tgz),
        "-C",
        dir,
        "package/bitwarden_wasm_internal.d.ts",
      ]);
    } catch (error) {
      fail(`failed to extract bitwarden_wasm_internal.d.ts from ${tgz}: ${error.message}`);
    }
    // Some commercial builds declare VERSION without shipping it, so extract it on its own.
    try {
      execFileSync("tar", ["-xzf", join(dir, tgz), "-C", dir, "package/VERSION"], {
        stdio: "ignore",
      });
    } catch {
      /* the SHA pair comes from the public package */
    }
  }

  const version_file = join(tarball, "VERSION");
  return {
    text: readFileSync(dts, "utf8"),
    sha: existsSync(version_file) ? readFileSync(version_file, "utf8").trim() : null,
  };
}

const normalize = (text) => text.replace(/\s+/g, " ").trim();

// Owner keys carry the declaration up to its body, so a member change does not also dirty its owner.
function header(node, source) {
  const text = node.getText(source);
  const body = text.indexOf("{");
  return normalize(body === -1 ? text : text.slice(0, body));
}

function extract(text, label) {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, false);
  if (source.parseDiagnostics?.length) {
    fail(`${label} did not parse: ${source.parseDiagnostics[0].messageText}`);
  }

  const declarations = new Map();

  for (const node of source.statements) {
    const name = node.name?.getText(source);
    if (!name) {
      continue;
    }

    if (ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      declarations.set(name, normalize(node.getText(source)));
      continue;
    }

    if (
      !ts.isClassDeclaration(node) &&
      !ts.isInterfaceDeclaration(node) &&
      !ts.isEnumDeclaration(node)
    ) {
      continue;
    }

    declarations.set(name, header(node, source));
    for (const member of node.members) {
      const member_name = ts.isConstructorDeclaration(member)
        ? "constructor"
        : (member.name?.getText(source) ?? "[index]");
      declarations.set(`${name}.${member_name}`, normalize(member.getText(source)));
    }
  }

  return declarations;
}

const before = fetchSurface(oldVersion);
const after = fetchSurface(newVersion);
const old_surface = extract(before.text, `${oldVersion}.d.ts`);
const new_surface = extract(after.text, `${newVersion}.d.ts`);

// An empty extraction reads as "nothing changed", the one wrong answer this must never give.
if (old_surface.size === 0 || new_surface.size === 0) {
  fail(
    `extracted ${old_surface.size} and ${new_surface.size} declarations; ` +
      "the extractor no longer matches the generated form",
  );
}

const removed = [...old_surface.keys()].filter((key) => !new_surface.has(key)).sort();
const added = [...new_surface.keys()].filter((key) => !old_surface.has(key)).sort();
const mutated = [...old_surface.keys()]
  .filter((key) => new_surface.has(key) && new_surface.get(key) !== old_surface.get(key))
  .sort();

const added_owners = new Set(added);
const ownerOf = (key) => (key.includes(".") ? key.slice(0, key.indexOf(".")) : null);

console.log("## RANGE");
console.log(`${pkg} ${oldVersion} -> ${newVersion}`);
if (before.sha && after.sha) {
  console.log(`sdk-internal ${before.sha}..${after.sha}`);
}
console.log(`declarations ${old_surface.size} -> ${new_surface.size}`);

console.log(`\n## REMOVED (${removed.length}) - absent at NEW; a compile break at every call site`);
for (const key of removed) {
  console.log(`  ${key}`);
}

console.log(`\n## ADDED (${added.length}) - only a pre-existing owner is a break`);
for (const key of added) {
  const owner = ownerOf(key);
  const note =
    owner === null ? "" : added_owners.has(owner) ? "  (new owner)" : "  (existing owner)";
  console.log(`  ${key}${note}`);
}

console.log(`\n## MUTATED (${mutated.length}) - key survives, its declaration changed`);
for (const key of mutated) {
  console.log(`  ${key}`);
  console.log(`    OLD: ${old_surface.get(key)}`);
  console.log(`    NEW: ${new_surface.get(key)}`);
}
