/**
 * Automated migration script to replace legacy BWI icon names with Figma names
 *
 * This script finds and replaces all occurrences of old BWI icon names with new Figma names:
 * - TypeScript/HTML string literals: "bwi-question-circle" → "bwi-help"
 * - SCSS classes: .bwi-question-circle → .bwi-help
 * - Comments and documentation
 *
 * Usage:
 *   npm run icons:migrate           # Execute migration
 *   npm run icons:migrate -- --dry-run  # Preview changes without modifying files
 */

import * as fs from "fs";
import * as path from "path";

import { BWI_TO_FIGMA } from "./migration-map";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT_DIR = path.join(__dirname, "../..");

// Directories to search for icon references
const SEARCH_PATHS = ["apps/", "libs/", "bitwarden_license/"];

// File extensions to process
const FILE_EXTENSIONS = [".ts", ".html", ".scss", ".css", ".md", ".mdx"];

interface Replacement {
  file: string;
  oldName: string;
  newName: string;
  occurrences: number;
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
      results.push(fullPath);
    }
  }

  return results;
}

function migrateIconNames(): void {
  const replacements: Replacement[] = [];

  // First, find all files to process
  const allFiles: string[] = [];
  for (const searchPath of SEARCH_PATHS) {
    const fullPath = path.join(ROOT_DIR, searchPath);
    allFiles.push(...findFiles(fullPath, FILE_EXTENSIONS));
  }

  // For each BWI name, search and replace across all files
  for (const [bwiName, figmaName] of Object.entries(BWI_TO_FIGMA)) {
    const oldPattern = `bwi-${bwiName}`;
    const newPattern = `bwi-${figmaName}`;

    for (const file of allFiles) {
      try {
        let content = fs.readFileSync(file, "utf-8");
        const originalContent = content;

        // Count occurrences before replacement
        // Use word boundaries to prevent partial matches (e.g., don't match "bwi-star-f" inside "bwi-star-filled")
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

  // Save detailed report
  if (!DRY_RUN && replacements.length > 0) {
    const reportPath = path.join(__dirname, "migration-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(replacements, null, 2), "utf-8");
  }
}

// Run migration
try {
  migrateIconNames();
} catch {
  process.exit(1);
}
