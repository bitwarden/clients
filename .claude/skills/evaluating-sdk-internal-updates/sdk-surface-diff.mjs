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

// Returns the published TypeScript declaration surface for `pkg`@`version`: downloads (or reuses
// a cached) `npm pack` tarball, extracts `bitwarden_wasm_internal.d.ts`, and, when the tarball
// also ships a VERSION file, the sdk-internal commit SHA it was built from.
function fetchSurface(version) {
  const dir = join(cache, version);
  const tarball = join(dir, "package");
  const sdkTypescriptTypeDefinitions = join(tarball, "bitwarden_wasm_internal.d.ts");

  if (!existsSync(sdkTypescriptTypeDefinitions)) {
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
    text: readFileSync(sdkTypescriptTypeDefinitions, "utf8"),
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

// Parses a `.d.ts` file's text into a Map of qualified name -> normalized declaration text.
// Top-level functions and type aliases each get one entry. Classes, interfaces, and enums get an
// entry for their own header (name only, so a member change does not also dirty its owner) plus
// one entry per member, keyed as `Owner.member`. This is what lets the diff below operate at
// member granularity.
function extractDeclarations(text, label) {
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
const old_surface = extractDeclarations(before.text, `${oldVersion}.d.ts`);
const new_surface = extractDeclarations(after.text, `${newVersion}.d.ts`);

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

// The two versions compared and, when both tarballs shipped a VERSION file, the sdk-internal
// commit range between them (the range step 5 walks for context on each change below).
function logRange() {
  console.log("## RANGE");
  console.log(`${pkg} ${oldVersion} -> ${newVersion}`);
  if (before.sha && after.sha) {
    console.log(`sdk-internal ${before.sha}..${after.sha}`);
  }
  console.log(`declarations ${old_surface.size} -> ${new_surface.size}`);
}

// Keys present at OLD but gone at NEW: every reference to one is now a compile error.
function logRemoved() {
  console.log(
    `\n## REMOVED (${removed.length}) - absent at NEW; a compile break at every call site`,
  );
  for (const key of removed) {
    console.log(`  ${key}`);
  }
}

// A key here exists at NEW but not OLD. It only counts as a break if its owner (the part before
// the dot, if any) already existed at OLD too; a brand-new class, interface, or enum cannot
// break a caller.
function logAdded() {
  console.log(`\n## ADDED (${added.length}) - only a pre-existing owner is a break`);
  for (const key of added) {
    const owner = ownerOf(key);
    const note =
      owner === null ? "" : added_owners.has(owner) ? "  (new owner)" : "  (existing owner)";
    console.log(`  ${key}${note}`);
  }
}

// Same key at both versions, but the normalized declaration text differs: the name held, the shape changed.
function logMutated() {
  console.log(`\n## MUTATED (${mutated.length}) - key survives, its declaration changed`);
  for (const key of mutated) {
    console.log(`  ${key}`);
    console.log(`    OLD: ${old_surface.get(key)}`);
    console.log(`    NEW: ${new_surface.get(key)}`);
  }
}

logRange();
logRemoved();
logAdded();
logMutated();
