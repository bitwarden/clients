#!/usr/bin/env ts-node

/**
 * Extract Material Icon SVG files based on BWI → Material mapping
 *
 * This script:
 * 1. Reads the icon mapping configuration
 * 2. Finds the corresponding Material Icon SVG files
 * 3. Copies them to a staging directory for font generation
 * 4. Renames them to match BWI icon names
 */

import * as fs from "fs";
import * as path from "path";

import { BWI_TO_MATERIAL_MAPPING } from "./icon-mapping";

// Configuration
const MATERIAL_ICONS_SOURCE = path.join(__dirname, "../../node_modules/@material-design-icons/svg");
const OUTPUT_DIR = path.join(__dirname, "../../.material-icons-staging");
const ICON_VARIANT = "outlined"; // Options: filled, outlined, round, sharp, two-tone

interface ExtractionResult {
  bwiName: string;
  materialName: string;
  sourcePath: string;
  outputPath: string;
  success: boolean;
  error?: string;
}

/**
 * Clean and prepare output directory
 */
function prepareOutputDirectory(): void {
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract a single Material Icon SVG
 */
function extractIcon(bwiName: string, materialName: string): ExtractionResult {
  const result: ExtractionResult = {
    bwiName,
    materialName,
    sourcePath: "",
    outputPath: "",
    success: false,
  };

  try {
    // Construct source path
    // Material Icons are organized as: svg/{variant}/{icon_name}.svg
    const sourcePath = path.join(MATERIAL_ICONS_SOURCE, ICON_VARIANT, `${materialName}.svg`);

    result.sourcePath = sourcePath;

    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      result.error = `Source file not found: ${sourcePath}`;
      return result;
    }

    // Read SVG content
    const svgContent = fs.readFileSync(sourcePath, "utf-8");

    // Create output filename: bwi-{name}.svg
    // This preserves the BWI naming convention for font generation
    const outputFileName = `${bwiName}.svg`;
    const outputPath = path.join(OUTPUT_DIR, outputFileName);

    result.outputPath = outputPath;

    // Write to output directory
    fs.writeFileSync(outputPath, svgContent, "utf-8");

    result.success = true;
    return result;
  } catch (error) {
    result.error = error.message;
    return result;
  }
}

/**
 * Extract all Material Icons based on mapping
 */
function extractAllIcons(): void {
  const results: ExtractionResult[] = [];
  const errors: ExtractionResult[] = [];

  // Process each mapping
  for (const [bwiName, materialName] of Object.entries(BWI_TO_MATERIAL_MAPPING)) {
    const result = extractIcon(bwiName, materialName);
    results.push(result);

    if (!result.success) {
      errors.push(result);
    }
  }

  // Save extraction report
  const reportPath = path.join(OUTPUT_DIR, "extraction-report.json");
  const report = {
    timestamp: new Date().toISOString(),
    variant: ICON_VARIANT,
    totalMapped: results.length,
    successful: results.filter((r) => r.success).length,
    failed: errors.length,
    results,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Create instructions file
  createInstructionsFile();
}

/**
 * Create instructions for next steps
 */
function createInstructionsFile(): void {
  const instructions = `
# Material Icons Extraction Complete

## What Was Done
- Extracted ${Object.keys(BWI_TO_MATERIAL_MAPPING).length} Material Icons (${ICON_VARIANT} variant)
- Renamed to match BWI icon names
- Saved to: ${OUTPUT_DIR}

## Next Steps: Generate Icon Font

### Option 1: Using IcoMoon (Recommended)
1. Go to https://icomoon.io/app
2. Click "Import Icons" button
3. Select all SVG files from: ${OUTPUT_DIR}
4. Select all imported icons
5. Click "Generate Font" at bottom
6. In font preferences:
   - Font Name: bwi-font
   - Class Prefix: bwi-
   - Keep existing icon names (they already have bwi- prefix)
7. Download the font package
8. Extract and copy these files to libs/angular/src/scss/bwicons/fonts/:
   - bwi-font.svg
   - bwi-font.ttf
   - bwi-font.woff
   - bwi-font.woff2

### Option 2: Using Fontello
1. Go to https://fontello.com
2. Drag and drop all SVG files from ${OUTPUT_DIR}
3. Assign each icon to its glyph code
4. Download font package
5. Copy font files to libs/angular/src/scss/bwicons/fonts/

### Option 3: Automated (Advanced)
Use a tool like 'fantasticon' or 'icon-font-generator':

\`\`\`bash
npm install -g fantasticon

fantasticon ${OUTPUT_DIR} \\
  --output-dir libs/angular/src/scss/bwicons/fonts \\
  --font-types woff2,woff,ttf,svg \\
  --name bwi-font \\
  --prefix bwi- \\
  --normalize
\`\`\`

## Testing
After replacing font files:
1. Run: npm run build
2. Start dev server: npm start
3. Check that all icons display correctly
4. Test across: browser extension, desktop app, web app

## Rollback
If anything goes wrong:
\`\`\`bash
git checkout HEAD -- libs/angular/src/scss/bwicons/fonts/
\`\`\`

## Current Font Files Location
${path.join(__dirname, "../../libs/angular/src/scss/bwicons/fonts")}
`;

  const instructionsPath = path.join(OUTPUT_DIR, "INSTRUCTIONS.md");
  fs.writeFileSync(instructionsPath, instructions.trim());
}

/**
 * Validate Material Icons package is installed
 */
function validateMaterialIconsPackage(): boolean {
  if (!fs.existsSync(MATERIAL_ICONS_SOURCE)) {
    throw new Error(
      `Material Icons package not found at ${MATERIAL_ICONS_SOURCE}. Install with: npm install @material-design-icons/svg`,
    );
  }

  const variantPath = path.join(MATERIAL_ICONS_SOURCE, ICON_VARIANT);
  if (!fs.existsSync(variantPath)) {
    throw new Error(`Icon variant '${ICON_VARIANT}' not found at ${variantPath}`);
  }

  return true;
}

/**
 * Main execution
 */
function main(): void {
  validateMaterialIconsPackage();
  prepareOutputDirectory();
  extractAllIcons();
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { extractIcon, extractAllIcons, prepareOutputDirectory };
