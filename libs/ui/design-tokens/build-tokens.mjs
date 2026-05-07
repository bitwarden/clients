import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import StyleDictionary from "style-dictionary";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(HERE, "build");
const SRC = join(HERE, "src/tokens");

// Source files. Light and dark values for theme-variant tokens are colocated
// per token via the `$mods` field; per-platform preprocessors (below) expand
// each token to its mode-specific value before SD's standard pipeline runs.
const SOURCES = [
  join(SRC, "color/primitive.json"),
  join(SRC, "color/primitive-rgb.json"),
  join(SRC, "color/legacy.json"),
  join(SRC, "color/semantic.json"),
  join(SRC, "color/plumbing.json"),
  join(SRC, "font.json"),
  join(SRC, "breakpoint.json"),
];

// `$mods` preprocessing -----------------------------------------------------
//
// `$mods` is a project-local convention (not yet in the DTCG spec, but aligned
// with the spec's emerging `$modes` direction): each theme-variant token holds
// its default value in `$value` and any per-mode override under
// `$mods.<modeName>`. The preprocessors below produce two views of the same
// source dictionary:
//
//   - "default" mode: strip `$mods`, leave `$value` untouched. All tokens
//     are emitted (theme-stable + theme-variant default values).
//   - "dark" mode: for each token, replace `$value` with `$mods.dark` if
//     present and drop the token entirely if there is no dark override.
//     This produces a dictionary containing only dark-specific overrides.
//
// Strict structural parity falls out of this: a "dark-only" token is
// impossible to express because dark values live inside light tokens.

// Default-mode preprocessor: strip `$mods`, leave `$value` as the active value.
// Every token is kept and emitted — this is the :root output.
function expandModsDefault(node) {
  if (!node || typeof node !== "object") return node;
  if ("$value" in node) {
    const { $mods, ...rest } = node;
    return rest;
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = expandModsDefault(v);
  return out;
}

// Mode preprocessor: for each token with `$mods.<mode>`, swap `$value` to that
// override and mark the token so the file filter knows to emit it. Tokens
// without an override are kept as-is so that references inside override values
// can still resolve to their (un-overridden) targets.
function expandModsForMode(node, mode) {
  if (!node || typeof node !== "object") return node;
  if ("$value" in node) {
    const override = node.$mods?.[mode];
    if (override === undefined) {
      const { $mods, ...rest } = node;
      return rest; // keep for resolution, no emit-marker
    }
    const { $mods, ...rest } = node;
    return {
      ...rest,
      $value: override,
      $extensions: {
        ...(rest.$extensions ?? {}),
        "com.bitwarden": {
          ...(rest.$extensions?.["com.bitwarden"] ?? {}),
          modeOverride: mode,
        },
      },
    };
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = expandModsForMode(v, mode);
  return out;
}

StyleDictionary.registerPreprocessor({
  name: "mods/default",
  preprocessor: (dictionary) => expandModsDefault(dictionary),
});
StyleDictionary.registerPreprocessor({
  name: "mods/dark",
  preprocessor: (dictionary) => expandModsForMode(dictionary, "dark"),
});

// Filter for the dark output: emit only tokens marked by the dark preprocessor.
const isDarkOverride = (token) =>
  token.$extensions?.["com.bitwarden"]?.modeOverride === "dark" ||
  token.extensions?.["com.bitwarden"]?.modeOverride === "dark";

// Custom transforms ---------------------------------------------------------
//
// Output formats are determined by the source file path, not by per-token
// metadata. Adding a token to `legacy.json` automatically routes it through
// the rgb-triplet-space transform; adding to `primitive-rgb.json` routes it
// through rgb-triplet-comma; etc.

const fpMatches = (token, regex) => regex.test((token.filePath || "").replaceAll("\\", "/"));

const hexToRgb = (hex) => {
  const v = hex.replace("#", "");
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
    a: v.length === 8 ? parseInt(v.slice(6, 8), 16) : 255,
  };
};

StyleDictionary.registerTransform({
  name: "color/rgb-triplet-space",
  type: "value",
  transitive: true,
  filter: (token) => fpMatches(token, /\/color\/legacy\.json$/),
  transform: (token) => {
    const { r, g, b } = hexToRgb(token.$value ?? token.value);
    return `${r} ${g} ${b}`;
  },
});

StyleDictionary.registerTransform({
  name: "color/rgb-triplet-comma",
  type: "value",
  transitive: true,
  filter: (token) => fpMatches(token, /\/color\/primitive-rgb\.json$/),
  transform: (token) => {
    const { r, g, b } = hexToRgb(token.$value ?? token.value);
    return `${r}, ${g}, ${b}`;
  },
});

StyleDictionary.registerTransform({
  name: "color/hex8-to-rgb-slash",
  type: "value",
  transitive: true,
  filter: (token) => {
    if (!fpMatches(token, /\/color\/plumbing\.json$/)) return false;
    const v = token.$value ?? token.value;
    return typeof v === "string" && /^#[0-9a-f]{8}$/i.test(v);
  },
  transform: (token) => {
    const { r, g, b, a } = hexToRgb(token.$value ?? token.value);
    const alpha = Math.round((a / 255) * 100) / 100;
    return `rgb(${r} ${g} ${b} / ${alpha})`;
  },
});

StyleDictionary.registerTransform({
  name: "fontFamily/css-double-quoted",
  type: "value",
  filter: (token) => token.$type === "fontFamily" || token.type === "fontFamily",
  transform: (token) => {
    const v = token.$value ?? token.value;
    const list = Array.isArray(v) ? v : [v];
    return list.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(", ");
  },
});

// Preserve var() references for semantic tokens; resolve them for `-rgb`
// siblings whose value is transformed at output time.
const outputReferences = (token) => !fpMatches(token, /\/color\/primitive-rgb\.json$/);

const TRANSFORMS = [
  "attribute/cti",
  "name/kebab",
  "color/rgb-triplet-space",
  "color/rgb-triplet-comma",
  "color/hex8-to-rgb-slash",
  "fontFamily/css-double-quoted",
];

const config = {
  source: SOURCES,
  log: { warnings: "disabled" },
  platforms: {
    "css-light": {
      preprocessors: ["mods/default"],
      transforms: TRANSFORMS,
      buildPath: BUILD_DIR + "/",
      files: [
        {
          destination: "tokens-light.css",
          format: "css/variables",
          options: { selector: ":root", outputReferences },
        },
      ],
    },
    "css-dark": {
      preprocessors: ["mods/dark"],
      transforms: TRANSFORMS,
      buildPath: BUILD_DIR + "/",
      files: [
        {
          destination: "tokens-dark.css",
          format: "css/variables",
          filter: isDarkOverride,
          options: { selector: ".theme_dark", outputReferences },
        },
      ],
    },
  },
};

const sd = new StyleDictionary(config);
await sd.hasInitialized;
await sd.buildAllPlatforms();

// Combine into a single tokens.css. Drop intermediates.
const light = readFileSync(join(BUILD_DIR, "tokens-light.css"), "utf8");
const dark = readFileSync(join(BUILD_DIR, "tokens-dark.css"), "utf8");
writeFileSync(join(BUILD_DIR, "tokens.css"), light + "\n" + dark);
rmSync(join(BUILD_DIR, "tokens-light.css"));
rmSync(join(BUILD_DIR, "tokens-dark.css"));

console.log("Built libs/ui/design-tokens/build/tokens.css");
