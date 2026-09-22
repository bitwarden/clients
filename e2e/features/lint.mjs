#!/usr/bin/env node

////
// Checks the shared feature tree against the two house rules that nothing else
// enforces.
//
// 1. Every scenario carries a suite tag. Tag filtering is silent: playwright-bdd
//    drops a file with no matching scenarios without a word, so an untagged Rule
//    or a typo like `@dekstop` would quietly stop being tested while still
//    reading as coverage.
// 2. One action and one outcome per scenario. `When -> Then -> When` means two
//    tests in one, so the second failure is hidden behind the first.
//
// Run: node e2e/features/lint.mjs
////

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Gherkin comes in with playwright-bdd rather than as a direct dependency, so it
// is absent until the workspace is installed. Say so, instead of throwing a
// module-resolution stack trace at whoever ran this.
let AstBuilder, GherkinClassicTokenMatcher, Parser, IdGenerator;

try {
  ({ AstBuilder, GherkinClassicTokenMatcher, Parser } = await import("@cucumber/gherkin"));
  ({ IdGenerator } = await import("@cucumber/messages"));
} catch {
  console.error("Cannot find @cucumber/gherkin. Run `npm install` first.");
  process.exit(1);
}

const FEATURES_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(FEATURES_DIR, "..", "..");

/**
 * Suites whose playwright config actually filters on this tag today. Keep in
 * step with the `tags` option in each `e2e/<suite>/playwright.config.ts`.
 */
const WIRED_SUITE_TAGS = new Set(["@desktop", "@browser-desktop"]);

/**
 * Suites that have no BDD runner yet, so nothing compiles a scenario tagged only
 * for them. `e2e/browser` and `e2e/web` run plain specs, and there is no CLI
 * suite at all. Move a tag up to WIRED_SUITE_TAGS when its config gains
 * `defineBddConfig`.
 */
const PLANNED_SUITE_TAGS = new Set(["@browser", "@web", "@cli", "@cli-desktop"]);

const SUITE_TAGS = new Set([...WIRED_SUITE_TAGS, ...PLANNED_SUITE_TAGS]);

/** Says a scenario is written ahead of its runner on purpose. */
const SPEC_ONLY_TAG = "@spec-only";

/** Conditions and playwright-bdd's own tags, which are not suite tags. */
const CONDITION_TAGS = new Set(["@windows", "@macos", "@linux"]);
const SPECIAL_TAGS = new Set(["@only", "@skip", "@fixme", "@fail", "@slow"]);
const SPECIAL_TAG_PREFIXES = ["@mode:", "@retries:", "@timeout:"];

function featureFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return featureFiles(path);
    }

    return entry.name.endsWith(".feature") ? [path] : [];
  });
}

function parse(path) {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );

  return parser.parse(readFileSync(path, "utf8"));
}

const tagNames = (node) => (node.tags ?? []).map((tag) => tag.name);

function isKnownTag(tag) {
  return (
    SUITE_TAGS.has(tag) ||
    CONDITION_TAGS.has(tag) ||
    SPECIAL_TAGS.has(tag) ||
    tag === SPEC_ONLY_TAG ||
    SPECIAL_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix))
  );
}

/** `And` and `But` continue whichever keyword came before them. */
function resolveKeywords(steps) {
  let previous = null;

  return steps.map((step) => {
    const keyword = step.keyword.trim();

    if (keyword === "And" || keyword === "But" || keyword === "*") {
      return previous;
    }

    previous = keyword;

    return keyword;
  });
}

function checkTags(node, report) {
  for (const tag of tagNames(node)) {
    if (!isKnownTag(tag)) {
      report(`unknown tag ${tag}. Add it to lint.mjs if it is intentional.`);
    }
  }
}

function checkScenario(scenario, inheritedTags, report) {
  const tags = [...inheritedTags, ...tagNames(scenario)];
  const where = `"${scenario.name}"`;

  checkTags(scenario, report);

  const suiteTags = tags.filter((tag) => SUITE_TAGS.has(tag));

  if (suiteTags.length === 0) {
    report(`${where} has no suite tag. Add one of: ${[...SUITE_TAGS].join(", ")}`);
  } else if (!suiteTags.some((tag) => WIRED_SUITE_TAGS.has(tag))) {
    // Every suite it names still runs plain specs, so nothing compiles this and
    // no report would ever mention it again.
    if (tags.includes(SPEC_ONLY_TAG)) {
      specOnly.push(`${where} — ${suiteTags.join(" ")}`);
    } else {
      report(
        `${where} is tagged ${suiteTags.join(" ")}, and no suite runs those yet, ` +
          `so it runs nowhere. Add a wired tag (${[...WIRED_SUITE_TAGS].join(", ")}) ` +
          `or mark it ${SPEC_ONLY_TAG} if that is deliberate.`,
      );
    }
  }

  const keywords = resolveKeywords(scenario.steps);
  const count = (kind) => keywords.filter((keyword) => keyword === kind).length;

  if (count("When") > 1) {
    report(`${where} has ${count("When")} When steps. Split it, or make the setup a Given.`);
  }

  if (count("Then") > 1) {
    report(`${where} has ${count("Then")} Then steps. One outcome per scenario.`);
  }

  const firstAction = keywords.findIndex((keyword) => keyword === "When" || keyword === "Then");

  if (firstAction !== -1 && keywords.slice(firstAction).includes("Given")) {
    report(`${where} has a Given after a When or Then. Givens come first.`);
  }
}

function checkChildren(children, inheritedTags, report) {
  for (const child of children) {
    if (child.rule) {
      checkTags(child.rule, report);
      checkChildren(child.rule.children, [...inheritedTags, ...tagNames(child.rule)], report);
    } else if (child.background) {
      const keywords = resolveKeywords(child.background.steps);
      const offenders = keywords.filter((keyword) => keyword !== "Given");

      if (offenders.length > 0) {
        report(`a Background has ${offenders.join(", ")} steps. Backgrounds are Givens only.`);
      }
    } else if (child.scenario) {
      checkScenario(child.scenario, inheritedTags, report);
    }
  }
}

let failures = 0;
const specOnly = [];

for (const path of featureFiles(FEATURES_DIR).sort()) {
  const shortPath = relative(REPO_ROOT, path);
  let document;

  try {
    document = parse(path);
  } catch (error) {
    console.error(`${shortPath}: ${error.message ?? error}`);
    failures += 1;
    continue;
  }

  const report = (message) => {
    console.error(`${shortPath}: ${message}`);
    failures += 1;
  };

  const feature = document.feature;

  if (feature == null) {
    report("no Feature found.");
    continue;
  }

  checkTags(feature, report);
  checkChildren(feature.children, tagNames(feature), report);
}

if (failures > 0) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}

// Printed every run on purpose. These are specified but unrunnable, and the
// point of this script is that such scenarios never go quiet.
if (specOnly.length > 0) {
  console.log(`${specOnly.length} scenario(s) specified ahead of their runner:`);
  specOnly.forEach((entry) => console.log(`  ${entry}`));
  console.log("");
}

console.log("Feature tree is clean.");
