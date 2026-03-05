/**
 * Reverse migration script to restore legacy BWI icon names in consumer code
 *
 * This script reverses the original migration by replacing Figma icon names
 * back to legacy BWI names in consumer code (apps, libs except libs/components).
 * This allows consumer code to use familiar legacy names while maintaining
 * bidirectional support through SCSS/TypeScript mappings.
 *
 * Usage:
 *   npm run icons:reverse-migrate           # Execute reverse migration
 *   npm run icons:reverse-migrate -- --dry-run  # Preview changes without modifying files
 */

import * as fs from "fs";
import * as path from "path";

import { BWI_TO_FIGMA } from "./migration-map";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT_DIR = path.join(__dirname, "../..");

// Directories to search for icon references
const SEARCH_PATHS = ["apps/", "libs/", "bitwarden_license/"];

// Paths to exclude from reverse migration (keep Figma names)
const EXCLUDE_PATHS = ["libs/components/"];

// File extensions to process
const FILE_EXTENSIONS = [".ts", ".html", ".scss", ".css", ".md", ".mdx"];

interface Replacement {
  file: string;
  oldName: string;
  newName: string;
  occurrences: number;
}

/**
 * Create reverse mapping: Figma → legacy
 */
function createReverseMapping(): Record<string, string> {
  const reverseMap: Record<string, string> = {};
  for (const [legacy, figma] of Object.entries(BWI_TO_FIGMA)) {
    // Only include if they're different (skip identity mappings)
    if (legacy !== figma) {
      reverseMap[figma] = legacy;
    }
  }
  return reverseMap;
}

/**
 * Check if file should be excluded from reverse migration
 */
function shouldExcludeFile(file: string): boolean {
  const relativePath = path.relative(ROOT_DIR, file);
  return EXCLUDE_PATHS.some((excluded) => relativePath.startsWith(excluded));
}

/**
 * Recursively find all files with specified extensions
 */
function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules, .git, dist, and other build directories
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "dist" ||
      entry.name === "build" ||
      entry.name === "coverage" ||
      entry.name === ".angular" ||
      entry.name === "storybook-static"
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      // Only include files that are not in excluded paths
      if (!shouldExcludeFile(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function reverseMigrateIconNames(): void {
  const replacements: Replacement[] = [];
  const FIGMA_TO_BWI = createReverseMapping();

  // eslint-disable-next-line no-console
  console.log("Starting reverse migration...");
  // eslint-disable-next-line no-console
  console.log(`Excluded paths: ${EXCLUDE_PATHS.join(", ")}`);
  // eslint-disable-next-line no-console
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no files will be modified)" : "LIVE (files will be modified)"}\n`,
  );

  // First, find all files to process
  const allFiles: string[] = [];
  for (const searchPath of SEARCH_PATHS) {
    const fullPath = path.join(ROOT_DIR, searchPath);
    allFiles.push(...findFiles(fullPath, FILE_EXTENSIONS));
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${allFiles.length} files to process\n`);

  // For each Figma name, search and replace with legacy BWI name
  for (const [figmaName, bwiName] of Object.entries(FIGMA_TO_BWI)) {
    const oldPattern = `bwi-${figmaName}`;
    const newPattern = `bwi-${bwiName}`;

    for (const file of allFiles) {
      try {
        let content = fs.readFileSync(file, "utf-8");
        const originalContent = content;

        // Count occurrences before replacement
        // Use word boundaries to prevent partial matches
        // Use negative lookahead to skip replacements when followed by a file extension
        const escapedPattern = oldPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escapedPattern}\\b(?!\\.[a-zA-Z]+)`, "g");
        const matches = content.match(regex);
        const occurrences = matches ? matches.length : 0;

        if (occurrences === 0) {
          continue;
        }

        // Replace all occurrences
        content = content.replace(regex, newPattern);

        if (content !== originalContent) {
          replacements.push({
            file: path.relative(ROOT_DIR, file),
            oldName: oldPattern,
            newName: newPattern,
            occurrences,
          });

          if (!DRY_RUN) {
            fs.writeFileSync(file, content, "utf-8");
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }
  }

  // Display summary
  // eslint-disable-next-line no-console
  console.log(`\n${"=".repeat(60)}`);
  // eslint-disable-next-line no-console
  console.log("Reverse Migration Summary");
  // eslint-disable-next-line no-console
  console.log(`${"=".repeat(60)}\n`);

  if (replacements.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No replacements needed. All consumer code already uses legacy names.");
  } else {
    // Group by icon name
    const byIcon: Record<string, { files: number; total: number }> = {};
    for (const replacement of replacements) {
      if (!byIcon[replacement.newName]) {
        byIcon[replacement.newName] = { files: 0, total: 0 };
      }
      byIcon[replacement.newName].files++;
      byIcon[replacement.newName].total += replacement.occurrences;
    }

    // eslint-disable-next-line no-console
    console.log("Replacements by icon:");
    for (const [icon, stats] of Object.entries(byIcon).sort((a, b) => a[0].localeCompare(b[0]))) {
      // eslint-disable-next-line no-console
      console.log(`  ${icon}: ${stats.total} occurrences in ${stats.files} files`);
    }

    const totalOccurrences = replacements.reduce((sum, r) => sum + r.occurrences, 0);
    const totalFiles = new Set(replacements.map((r) => r.file)).size;

    // eslint-disable-next-line no-console
    console.log(`\nTotal: ${totalOccurrences} replacements in ${totalFiles} files`);
  }

  // Save detailed report
  if (!DRY_RUN && replacements.length > 0) {
    const reportPath = path.join(__dirname, "reverse-migration-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(replacements, null, 2), "utf-8");
    // eslint-disable-next-line no-console
    console.log(`\nDetailed report saved to: ${path.relative(ROOT_DIR, reportPath)}`);
  }

  if (DRY_RUN && replacements.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\n⚠️  DRY RUN: No files were modified. Run without "--dry-run" to apply changes.');
  } else if (!DRY_RUN && replacements.length > 0) {
    // eslint-disable-next-line no-console
    console.log("\n✓ Reverse migration complete!");
  }

  // eslint-disable-next-line no-console
  console.log(`\n${"=".repeat(60)}\n`);
}

// Run reverse migration
try {
  reverseMigrateIconNames();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error("Error during reverse migration:", error);
  process.exit(1);
}
