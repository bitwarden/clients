import fs from "node:fs";
import path from "node:path";

export const messages = {
  selfImport:
    "Import within the same package using a relative path instead of the '{{alias}}' alias.",
};

const toPosix = (p) => p.replace(/\\/g, "/");

// Cache of repoRoot -> parsed `@bitwarden/*` path entries so tsconfig.base.json is read once.
const entriesCache = new Map();

/** Walk up from `startDir` until a directory containing tsconfig.base.json is found. */
function findRepoRoot(startDir) {
  let dir = startDir;

  while (true) {
    if (fs.existsSync(path.join(dir, "tsconfig.base.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Build the list of `{ alias, dir }` entries from tsconfig.base.json's `@bitwarden/*` path map.
 * `alias` has any trailing `/*` removed; `dir` is a repo-relative posix path with `./`, `/*`, and
 * `/index.ts` removed.
 */
function loadPathEntries(repoRoot) {
  const cached = entriesCache.get(repoRoot);
  if (cached) {
    return cached;
  }

  const raw = fs.readFileSync(path.join(repoRoot, "tsconfig.base.json"), "utf8");
  const paths = JSON.parse(raw).compilerOptions?.paths ?? {};

  const entries = [];
  for (const [key, values] of Object.entries(paths)) {
    if (!key.startsWith("@bitwarden/") || !Array.isArray(values) || values.length === 0) {
      continue;
    }
    const alias = key.replace(/\/\*$/, "");
    const dir = toPosix(values[0])
      .replace(/^\.\//, "")
      .replace(/\/\*$/, "")
      .replace(/\/index\.ts$/, "");
    entries.push({ alias, dir });
  }

  entriesCache.set(repoRoot, entries);
  return entries;
}

/** The package whose `dir` is the longest path-prefix of the (repo-relative posix) file. */
function findOwner(entries, relFile) {
  let best = null;
  for (const entry of entries) {
    if (relFile === entry.dir || relFile.startsWith(entry.dir + "/")) {
      if (best == null || entry.dir.length > best.dir.length) {
        best = entry;
      }
    }
  }
  return best;
}

/** Resolve an alias import to its repo-relative posix target via the longest matching alias. */
function resolveAliasTarget(entries, source) {
  let best = null;
  for (const entry of entries) {
    if (source === entry.alias || source.startsWith(entry.alias + "/")) {
      if (best == null || entry.alias.length > best.alias.length) {
        best = entry;
      }
    }
  }
  if (best == null) {
    return null;
  }
  return best.dir + source.slice(best.alias.length);
}

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow importing a package's own '@bitwarden/*' alias; use relative paths",
      category: "Best Practices",
      recommended: false,
    },
    fixable: "code",
    messages,
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (!filename || !path.isAbsolute(filename)) {
      return {};
    }

    const fileAbs = toPosix(path.resolve(filename));
    const repoRoot = findRepoRoot(path.dirname(fileAbs));
    if (repoRoot == null) {
      return {};
    }

    const repoRootPosix = toPosix(repoRoot);
    const entries = loadPathEntries(repoRoot);
    const relFile = fileAbs.slice(repoRootPosix.length + 1);

    const owner = findOwner(entries, relFile);
    if (owner == null) {
      return {};
    }
    const selfAlias = owner.alias;

    function check(node) {
      const source = node.source;
      if (source == null || typeof source.value !== "string") {
        return;
      }

      const importSource = source.value;
      if (importSource !== selfAlias && !importSource.startsWith(selfAlias + "/")) {
        return;
      }

      context.report({
        node: source,
        messageId: "selfImport",
        data: { alias: selfAlias },
        fix(fixer) {
          const target = resolveAliasTarget(entries, importSource);
          if (target == null) {
            return null;
          }

          let rel = toPosix(path.relative(path.dirname(fileAbs), repoRootPosix + "/" + target));
          if (rel === "") {
            rel = ".";
          }
          if (!rel.startsWith(".")) {
            rel = "./" + rel;
          }

          const quote = source.raw[0];
          return fixer.replaceText(source, quote + rel + quote);
        },
      });
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};
