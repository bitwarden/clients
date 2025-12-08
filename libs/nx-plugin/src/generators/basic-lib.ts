import { execSync } from "child_process";
import * as path from "path";

import {
  formatFiles,
  generateFiles,
  Tree,
  offsetFromRoot,
  updateJson,
  runTasksInSerial,
  GeneratorCallback,
} from "@nx/devkit";

import { BasicLibGeneratorSchema } from "./schema";

/**
 * An Nx generator for creating basic libraries.
 * Generators help automate repetitive tasks like creating new components, libraries, or apps.
 *
 * @param {Tree} tree - The virtual file system tree that Nx uses to make changes
 * @param {BasicLibGeneratorSchema} options - Configuration options for the generator
 * @returns {Promise<void>} - Returns a promise that resolves when generation is complete
 */
export async function basicLibGenerator(
  tree: Tree,
  options: BasicLibGeneratorSchema,
): Promise<GeneratorCallback> {
  const projectRoot = `${options.directory}/${options.name}`;
  const srcRoot = `${projectRoot}/src`;

  /**
   * Generate files from templates in the 'files/' directory.
   * This copies all template files to the new library location.
   */
  generateFiles(tree, path.join(__dirname, "files"), projectRoot, {
    ...options,
    // `tmpl` is used in file names for template files. Setting it to an
    // empty string here lets use be explicit with the naming of template
    // files, and lets Nx handle stripping out "__tmpl__" from file names.
    tmpl: "",
    // `name` is a variable passed to template files for interpolation into
    // their contents. It is set to the name of the library being generated.
    name: options.name,
    root: projectRoot,
    // `offsetFromRoot` is helper to calculate relative path from the new
    // library to project root.
    offsetFromRoot: offsetFromRoot(projectRoot),
  });

  // Add TypeScript path to the base tsconfig
  updateTsConfigPath(tree, options.name, srcRoot);

  // Update CODEOWNERS with the new lib
  updateCodeowners(tree, options.directory, options.name, options.team);

  // Update jest.config.js with the new lib
  updateJestConfig(tree, options.directory, options.name);

  // Format all new files with prettier
  await formatFiles(tree);

  const tasks: GeneratorCallback[] = [];
  // Run npm i after generation. Nx ships a helper function for this called
  // installPackagesTask. When used here it was leaving package-lock in a
  // broken state, so a manual approach was used instead.
  tasks.push(() => {
    execSync("npm install", { stdio: "inherit" });
    return Promise.resolve();
  });
  return runTasksInSerial(...tasks);
}

/**
 * Updates the base tsconfig.json file to include the new library.
 * This allows importing the library using its alias path.
 *
 * @param {Tree} tree - The virtual file system tree
 * @param {string} name - The library name
 * @param {string} srcRoot - Path to the library's source files
 */
function updateTsConfigPath(tree: Tree, name: string, srcRoot: string) {
  updateJson(tree, "tsconfig.base.json", (json) => {
    const paths = json.compilerOptions.paths || {};

    paths[`@bitwarden/${name}`] = [`${srcRoot}/index.ts`];

    json.compilerOptions.paths = paths;
    return json;
  });
}

/**
 * Updates the CODEOWNERS file to add ownership for the new library
 *
 * @param {Tree} tree - The virtual file system tree
 * @param {string} directory - Directory where the library is created
 * @param {string} name - The library name
 * @param {string} team - The team responsible for the library
 */
function updateCodeowners(tree: Tree, directory: string, name: string, team: string) {
  const codeownersPath = ".github/CODEOWNERS";

  if (!tree.exists(codeownersPath)) {
    console.warn("CODEOWNERS file not found at .github/CODEOWNERS");
    return;
  }

  const teamHandleMap: Record<string, string> = {
    "admin-console": "@bitwarden/team-admin-console-dev",
    auth: "@bitwarden/team-auth-dev",
    autofill: "@bitwarden/team-autofill-dev",
    billing: "@bitwarden/team-billing-dev",
    "data-insights-and-reporting": "@bitwarden/team-data-insights-and-reporting-dev",
    "key-management": "@bitwarden/team-key-management-dev",
    platform: "@bitwarden/team-platform-dev",
    tools: "@bitwarden/team-tools-dev",
    "ui-foundation": "@bitwarden/team-ui-foundation",
    vault: "@bitwarden/team-vault-dev",
  };

  const teamHandle = teamHandleMap[team] || `@bitwarden/team-${team}-dev`;
  const libPath = `${directory}/${name}`;

  const newLine = `${libPath} ${teamHandle}\n`;

  const content = tree.read(codeownersPath)?.toString() || "";
  tree.write(codeownersPath, content + newLine);
}

/**
 * Updates the jest.config.js file to include the new library
 * This ensures the library's tests are included in CI runs
 *
 * @param {Tree} tree - The virtual file system tree
 * @param {string} directory - Directory where the library is created
 * @param {string} name - The library name
 */
function updateJestConfig(tree: Tree, directory: string, name: string) {
  const jestConfigPath = "jest.config.js";

  if (!tree.exists(jestConfigPath)) {
    console.warn("jest.config.js file not found at root");
    return;
  }

  const content = tree.read(jestConfigPath)?.toString() || "";
  const libJestPath = `"<rootDir>/${directory}/${name}/jest.config.js",`;

  // Find the libs section and insert the new library in alphabetical order
  const lines = content.split("\n");
  let insertIndex = -1;
  let foundLibsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're in the libs section
    if (line.includes('"<rootDir>/libs/')) {
      foundLibsSection = true;

      // Extract the lib name for comparison
      const match = line.match(/"<rootDir>libs([^"]+)/);
      if (match) {
        const existingLibName = match[1];

        // If the new lib should come before this existing lib alphabetically
        if (name < existingLibName) {
          insertIndex = i;
          break;
        }
      }
    }
    // If we were in libs section but hit a non-libs line, insert at end of libs
    else if (foundLibsSection && !line.includes('"<rootDir>/libs/')) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    console.warn(`Could not find appropriate location to insert ${name} in jest.config.js`);
    return;
  }

  // Insert the new library line
  lines.splice(insertIndex, 0, `    ${libJestPath}`);

  // Write back the updated content
  tree.write(jestConfigPath, lines.join("\n"));
}

export default basicLibGenerator;
