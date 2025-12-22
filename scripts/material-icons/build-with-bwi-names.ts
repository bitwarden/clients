#!/usr/bin/env ts-node

/**
 * Builds icon font with BWI names by temporarily renaming files
 * This eliminates the need for SCSS aliases
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const ICONS_DIR = path.join(__dirname, "../../libs/assets/src/material-icons");
const SCSS_PATH = path.join(__dirname, "../../libs/angular/src/scss/bwicons/styles/style.scss");

// Mapping from Figma icon names to BWI icon names (without bwi- prefix)
// Each Figma icon can map to one or more BWI names
const FIGMA_TO_BWI: Record<string, string | string[]> = {
  // Status Indicators
  help: "question-circle",
  info: "info-circle",
  loading: "spinner",
  "star-filled": "star-f",

  // Actions
  add: "plus",
  "add-circle": "plus-circle",
  copy: "clone",
  edit: "pencil-square",
  "edit-alt": "pencil",
  duplicate: "files",
  upload: "import",
  mail: "envelope",
  "new-window": "popout",
  settings: "cog",
  "settings-1": "cog-f",
  "subtract-circle": "minus-circle",
  visibility: "eye",
  "visibility-off": "eye-slash",
  delete: "trash",

  // Navigation & Menu
  "angle-up-down": "up-down-btn",
  "arrow-filled-down": "down-solid",
  "arrow-filled-up": "up-solid",
  drag: "drag-and-drop",
  grid: "filter",
  "more-horizontal": "ellipsis-h",
  "more-vertical": "ellipsis-v",
  warning: "exclamation-triangle",

  // Bitwarden Objects
  collection: ["collection", "collection-shared"],
  groups: "users",
  identity: "id-card",
  login: "globe",
  note: "sticky-note",
  attach: "paperclip",

  // Devices & Platforms
  "desktop-user": "user-monitor",

  // Misc
  diamond: "premium",
  accessibility: "universal-access",
  "bitwarden-shield": "shield",
  notifications: "bell",
  palette: "brush",
  receipt: "billing",
  extension: "puzzle",
  handshake: "provider",
  encrypted: "lock-encrypted",
  "lock-filled": "lock-f",
  terminal: "cli",
};

interface RenameOperation {
  from: string;
  to: string;
}

function buildIconFont(): void {
  const renameOps: RenameOperation[] = [];

  try {
    // Step 1: Rename Figma icons to BWI names
    for (const [figmaName, bwiName] of Object.entries(FIGMA_TO_BWI)) {
      const fromPath = path.join(ICONS_DIR, `${figmaName}.svg`);

      // Handle both string and array values
      const bwiNames = Array.isArray(bwiName) ? bwiName : [bwiName];

      for (const targetName of bwiNames) {
        const toPath = path.join(ICONS_DIR, `${targetName}.svg`);

        if (fs.existsSync(fromPath)) {
          // For first target, move the file; for subsequent targets, copy it
          if (targetName === bwiNames[0]) {
            fs.renameSync(fromPath, toPath);
          } else {
            fs.copyFileSync(path.join(ICONS_DIR, `${bwiNames[0]}.svg`), toPath);
          }
          renameOps.push({ from: fromPath, to: toPath });
        }
      }
    }

    // Step 2: Generate icon font
    execSync(
      'fantasticon libs/assets/src/material-icons -o libs/angular/src/scss/bwicons/fonts -t woff2 woff ttf svg -n bwi-font --selector ".bwi-%s" --normalize -h 1024 --descent 128',
      { stdio: "inherit" },
    );

    // Step 3: Update SCSS
    const jsonPath = path.join(
      __dirname,
      "../../libs/angular/src/scss/bwicons/fonts/bwi-font.json",
    );
    const glyphMap: Record<string, number> = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    const entries = Object.entries(glyphMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, code]) => {
        const hex = code.toString(16);
        return `  "${name}": "\\${hex}"`;
      });

    const iconCount = entries.length;
    const iconsMapContent = `// For new icons - add their glyph name and value to the map below
// Also add to \`libs/components/src/shared/icon.ts\`
// Auto-generated from Figma icons (${iconCount} icons)
$icons: (
${entries.join(",\n")}
);`;

    let scssContent = fs.readFileSync(SCSS_PATH, "utf-8");

    // Replace the $icons map
    const iconsMapRegex = /\/\/ For new icons - add their glyph name[\s\S]*?\$icons: \([\s\S]*?\);/;
    scssContent = scssContent.replace(iconsMapRegex, iconsMapContent);

    // Remove the BWI aliases section since we don't need it anymore
    const aliasesRegex = /\/\/ BWI name aliases for Figma icons[\s\S]*?(?=\n\/\/|$)/;
    scssContent = scssContent.replace(aliasesRegex, "");

    fs.writeFileSync(SCSS_PATH, scssContent, "utf-8");

    // Step 4: Cleanup temporary files
    execSync("rm -f libs/angular/src/scss/bwicons/fonts/bwi-font.{css,html,json,ts}", {
      stdio: "inherit",
    });
  } finally {
    // Step 5: Restore original Figma names
    const processedSources = new Set<string>();

    for (const { from, to } of renameOps) {
      if (fs.existsSync(to)) {
        // If this is the first target for this source, rename it back
        // Otherwise, it's a copy that should just be deleted
        if (!processedSources.has(from)) {
          fs.renameSync(to, from);
          processedSources.add(from);
        } else {
          fs.unlinkSync(to);
        }
      }
    }
  }
}

buildIconFont();
