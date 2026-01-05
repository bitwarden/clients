import { Tree, readProjectConfiguration } from "@nx/devkit";
import { createTreeWithEmptyWorkspace } from "@nx/devkit/testing";

import { basicLibGenerator } from "./basic-lib";
import { BasicLibGeneratorSchema } from "./schema";

describe("basic-lib generator", () => {
  let tree: Tree;
  const options: BasicLibGeneratorSchema = {
    name: "test",
    description: "test",
    team: "platform",
    directory: "libs",
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it("should update tsconfig.base.json paths", async () => {
    tree.write("tsconfig.base.json", JSON.stringify({ compilerOptions: { paths: {} } }));
    await basicLibGenerator(tree, options);
    const tsconfigContent = tree.read("tsconfig.base.json");
    expect(tsconfigContent).not.toBeNull();
    const tsconfig = JSON.parse(tsconfigContent?.toString() ?? "");
    expect(tsconfig.compilerOptions.paths[`@bitwarden/${options.name}`]).toEqual([
      `libs/test/src/index.ts`,
    ]);
  });

  it("should update CODEOWNERS file", async () => {
    tree.write(".github/CODEOWNERS", "# Existing content\n");
    await basicLibGenerator(tree, options);
    const codeownersContent = tree.read(".github/CODEOWNERS");
    expect(codeownersContent).not.toBeNull();
    const codeowners = codeownersContent?.toString();
    expect(codeowners).toContain(`libs/test @bitwarden/team-platform-dev`);
  });

  it("should generate expected files", async () => {
    await basicLibGenerator(tree, options);

    const config = readProjectConfiguration(tree, "test");
    expect(config).toBeDefined();

    expect(tree.exists(`libs/test/README.md`)).toBeTruthy();
    expect(tree.exists(`libs/test/eslint.config.mjs`)).toBeTruthy();
    expect(tree.exists(`libs/test/jest.config.js`)).toBeTruthy();
    expect(tree.exists(`libs/test/package.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/tsconfig.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/tsconfig.lib.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/tsconfig.spec.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/src/index.ts`)).toBeTruthy();
  });

  it("should handle missing CODEOWNERS file gracefully", async () => {
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    await basicLibGenerator(tree, options);
    expect(consoleSpy).toHaveBeenCalledWith("CODEOWNERS file not found at .github/CODEOWNERS");
    consoleSpy.mockRestore();
  });

  it("should map team names to correct GitHub handles", async () => {
    tree.write(".github/CODEOWNERS", "");
    await basicLibGenerator(tree, { ...options, team: "vault" });
    const codeownersContent = tree.read(".github/CODEOWNERS");
    expect(codeownersContent).not.toBeNull();
    const codeowners = codeownersContent?.toString();
    expect(codeowners).toContain(`libs/test @bitwarden/team-vault-dev`);
  });

  it("should generate expected files", async () => {
    await basicLibGenerator(tree, options);
    expect(tree.exists(`libs/test/README.md`)).toBeTruthy();
    expect(tree.exists(`libs/test/eslint.config.mjs`)).toBeTruthy();
    expect(tree.exists(`libs/test/jest.config.js`)).toBeTruthy();
    expect(tree.exists(`libs/test/package.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/project.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/tsconfig.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/tsconfig.lib.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/tsconfig.spec.json`)).toBeTruthy();
    expect(tree.exists(`libs/test/src/index.ts`)).toBeTruthy();
    expect(tree.exists(`libs/test/src/test.spec.ts`)).toBeTruthy();
  });
});

it("should update jest.config.js with new library", async () => {
  // Create a mock jest.config.js with existing libs
  const existingJestConfig = `module.exports = {
  projects: [
    "<rootDir>/apps/browser/jest.config.js",
    "<rootDir>/libs/admin-console/jest.config.js",
    "<rootDir>/libs/auth/jest.config.js",
    "<rootDir>/libs/vault/jest.config.js",
  ],
};`;
  tree.write("jest.config.js", existingJestConfig);

  await basicLibGenerator(tree, options);

  const jestConfigContent = tree.read("jest.config.js");
  expect(jestConfigContent).not.toBeNull();
  const jestConfig = jestConfigContent?.toString();

  // Should contain the new library in alphabetical order
  expect(jestConfig).toContain('"<rootDir>/libs/test/jest.config.js",');

  // Should be in the right alphabetical position (after auth, before vault)
  const authIndex = jestConfig?.indexOf('"<rootDir>/libs/auth/jest.config.js"');
  const testIndex = jestConfig?.indexOf('"<rootDir>/libs/test/jest.config.js"');
  const vaultIndex = jestConfig?.indexOf('"<rootDir>/libs/vault/jest.config.js"');

  expect(authIndex).toBeDefined();
  expect(testIndex).toBeDefined();
  expect(vaultIndex).toBeDefined();
  expect(authIndex! < testIndex!).toBeTruthy();
  expect(testIndex! < vaultIndex!).toBeTruthy();
});

it("should handle missing jest.config.js file gracefully", async () => {
  const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
  // Don't create jest.config.js file
  await basicLibGenerator(tree, options);
  expect(consoleSpy).toHaveBeenCalledWith("jest.config.js file not found at root");
  consoleSpy.mockRestore();
});
