import * as customizeKeys from "./table-customize-keys";

/**
 * Mirrors `state-definitions.spec.ts`. A test rather than a lint rule because ESLint runs
 * with `--cache`, so a rule would not re-read the unchanged declaration it must compare to.
 */
describe("table customize keys", () => {
  const tracked: [exportName: string, key: string][] = [];

  test.each(Object.entries(customizeKeys))("that export %s follows all rules", (name, key) => {
    if (typeof key !== "string") {
      throw new Error(`export ${name} is expected to be a customize key string`);
    }

    const conflict = tracked.find(([, trackedKey]) => trackedKey === key);
    if (conflict) {
      throw new Error(
        `The export '${name}' has the same customize key as '${conflict[0]}'. Two tables ` +
          `sharing a key share one stored set of hidden columns — choose a unique key.`,
      );
    }

    expect(key.length).toBeGreaterThan(3); // Too short to be descriptive
    expect(key).not.toContain(" "); // Keys are storage identifiers, not labels
    // All-lowercase, so two keys can never differ from one another by casing alone.
    expect(key).toEqual(key.toLowerCase());

    tracked.push([name, key]);
  });
});
