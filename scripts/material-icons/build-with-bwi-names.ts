#!/usr/bin/env ts-node

/**
 * Builds icon font with Figma names directly (no remapping needed)
 * Handles icon variants for one-to-many mappings
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { FIGMA_VARIANTS } from "./migration-map";

const ICONS_DIR = path.join(__dirname, "../../libs/assets/src/material-icons");
const SCSS_PATH = path.join(__dirname, "../../libs/angular/src/scss/bwicons/styles/style.scss");

function buildIconFont(): void {
  const variantFiles: string[] = [];

  try {
    // Step 1: Handle variants (copy files for one-to-many mappings)
    for (const [figmaName, variants] of Object.entries(FIGMA_VARIANTS)) {
      const sourcePath = path.join(ICONS_DIR, `${figmaName}.svg`);

      for (const variantName of variants) {
        const targetPath = path.join(ICONS_DIR, `${variantName}.svg`);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          variantFiles.push(targetPath);
          // eslint-disable-next-line no-console
          console.log(`Created variant: ${variantName}.svg from ${figmaName}.svg`);
        }
      }
    }

    // Step 2: Generate icon font directly from Figma-named SVGs
    // eslint-disable-next-line no-console
    console.log("\nGenerating icon font...");
    execSync(
      'fantasticon libs/assets/src/material-icons -o libs/angular/src/scss/bwicons/fonts -t woff2 woff ttf svg -n bwi-font --selector ".bwi-%s" --normalize -h 1024 --descent 128',
      { stdio: "inherit" },
    );

    // Step 3: Update SCSS
    // eslint-disable-next-line no-console
    console.log("\nUpdating SCSS...");
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

    fs.writeFileSync(SCSS_PATH, scssContent, "utf-8");

    // Step 4: Cleanup temporary files
    // eslint-disable-next-line no-console
    console.log("\nCleaning up...");
    execSync("rm -f libs/angular/src/scss/bwicons/fonts/bwi-font.{css,html,json,ts}", {
      stdio: "inherit",
    });

    // eslint-disable-next-line no-console
    console.log("\n✓ Icon font build complete!");
    // eslint-disable-next-line no-console
    console.log(`  Generated ${iconCount} icons with Figma names`);
  } finally {
    // Step 5: Remove variant copies
    for (const variantFile of variantFiles) {
      if (fs.existsSync(variantFile)) {
        fs.unlinkSync(variantFile);
      }
    }
  }
}

buildIconFont();
